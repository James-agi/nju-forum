import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireKnowledgeUser } from "@/lib/knowledge/authz";
import { buildCardBoundedAnswer } from "@/lib/knowledge/answer";
import { expandQueryTerms } from "@/lib/knowledge/query-expansion";
import { checkRateLimit } from "@/lib/knowledge/rate-limit";
import { evaluateEvidence, retrieveHybrid } from "@/lib/knowledge/retrieval";
import { classifyNeedsClarification, classifyNoResult, classifyP0Scope } from "@/lib/knowledge/scope";
import {
  askRequestSchema,
  formatValidationError,
  normalizeQuestionText,
} from "@/lib/knowledge/validation";
import { analyzeRetrievalTerms } from "@/lib/knowledge/term-extraction";
import type { AskResponse, CitationDTO, DirectCardDTO, ResultExplanation } from "@/lib/knowledge/types";
import type { RetrievalResult } from "@/lib/knowledge/types-internal";
import { TraceBuilder } from "@/lib/knowledge/trace";
import { getOrCreateConversation, getConversationHistory } from "@/lib/knowledge/conversation";
import { answerCache } from "@/lib/knowledge/cache";
import { tryAcquireAskSlot, type AskConcurrencyBusyReason } from "@/lib/knowledge/concurrency";

export const dynamic = "force-dynamic";

const GAP_MESSAGE =
  "现有知识卡片证据不足，已申请作者补充或整理成知识卡片。P0 不会基于猜测作答，也不会自动代发论坛帖。";

const FEEDBACK_PROMPT =
  "（以上回答仅供参考。如果不符合你的预期，请提交反馈帮助我们改进。）";

function toDirectCardDTO(result: RetrievalResult): DirectCardDTO {
  return {
    cardId: result.card.id,
    summary: result.card.summary,
    body: result.card.body,
    sourceExcerpt: result.card.sourceExcerpt,
    sourceDescription: result.card.sourceDescription,
    sourceUrl: result.card.sourceUrl,
    sourceType: result.card.sourceType,
    verificationStatus: result.card.verificationStatus,
    domainTag: result.card.domainTag,
    score: result.score,
    matchedTerms: result.matchedTerms,
  };
}

function withDebugTrace<T extends AskResponse>(
  response: T,
  trace: TraceBuilder,
  role: string,
): T {
  if (role !== "ADMIN") return response;
  return { ...response, trace: trace.build() };
}

function buildResultExplanation(trace: TraceBuilder): ResultExplanation {
  const current = trace.build();
  const selectedCards = current.evidence?.selectedCards || [];
  return {
    keywords: current.termExtraction?.terms || [],
    appliedAliases: (current.termExtraction?.aliases || [])
      .filter((alias) => alias.status === "APPLIED")
      .map((alias) => ({
        triggers: alias.matchedTriggers,
        targets: alias.targets,
      })),
    evidence: {
      sufficient: Boolean(current.evidence?.sufficient),
      cardCount: current.evidence?.cardsCount || 0,
      selectedCards: selectedCards.map((card) => ({
        summary: card.summary,
        matchedTerms: card.terms,
        verificationStatus: card.verificationStatus,
      })),
    },
  };
}

function withExplanation<T extends AskResponse>(response: T, trace: TraceBuilder): T {
  return { ...response, explanation: buildResultExplanation(trace) };
}

function withResponseDetails<T extends AskResponse>(
  response: T,
  trace: TraceBuilder,
  role: string,
): T {
  return withDebugTrace(withExplanation(response, trace), trace, role);
}

function getAskBusyPayload(reason: AskConcurrencyBusyReason) {
  if (reason === "think") {
    return {
      code: "ASK_THINK_BUSY",
      error: "当前思考回答人数较多，请稍后再试。你也可以先切到「不思考」查看相关知识卡片。",
    };
  }

  if (reason === "cards") {
    return {
      code: "ASK_CARDS_BUSY",
      error: "当前找卡片人数较多，请稍后再试。",
    };
  }

  return {
    code: "ASK_BUSY",
    error: "当前问答人数较多，请稍后再试。你也可以先查看相关知识卡片。",
  };
}

export async function POST(req: Request) {
  const trace = new TraceBuilder();
  trace.mark("start");

  try {
    const authz = await requireKnowledgeUser();
    if (!authz.ok) return authz.response;

    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateCheck = checkRateLimit(ip, authz.user?.id ?? null);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { code: "RATE_LIMITED", error: "你问得有点快，稍等几秒再试。" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs || 12000) / 1000)) } },
      );
    }

    const payload = await req.json();
    const parsed = askRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 },
      );
    }

    const questionText = parsed.data.question;
    const responseMode = parsed.data.mode;
    const normalizedQuestion = normalizeQuestionText(questionText);
    trace.setNormalizedQuestion(normalizedQuestion);

    // 多轮对话只用于总结回答；直接卡片模式不写入会话上下文。
    let conversationId: string | undefined;
    let turnIndex: number | undefined;
    let conversationHistory: Array<{ question: string; answer: string }> = [];

    if (authz.user && responseMode === "think") {
      const conv = await getOrCreateConversation(authz.user.id, parsed.data.conversationId);
      conversationId = conv.conversationId;
      turnIndex = conv.turnIndex;
      if (turnIndex > 1) {
        conversationHistory = await getConversationHistory(conversationId, 3);
      }
    }

    trace.mark("scope");
    const scope = classifyP0Scope(questionText);
    trace.setScope({
      inScope: scope.inScope,
      code: scope.code,
      label: scope.label,
      durationMs: trace.elapsedMs("scope"),
    });

    if (!scope.inScope) {
      const question = await db.knowledgeQuestion.create({
        data: {
          askerId: authz.user?.id ?? null,
          originalText: questionText,
          normalizedText: normalizedQuestion,
          status: "OUT_OF_SCOPE",
          trace: trace.toJSON(),
          conversationId,
          turnIndex,
        },
      });

      const response: AskResponse = {
        status: "OUT_OF_SCOPE",
        questionId: question.id,
        conversationId,
        turnIndex,
        message: scope.message || "这个请求不属于 P0 的 NJU 信息沉淀范围。",
      };

      return NextResponse.json(withResponseDetails(response, trace, authz.user.role));
    }

    trace.mark("termExtraction");
    const termTrace = await analyzeRetrievalTerms(questionText);
    trace.setTermExtraction({
      ...termTrace,
      durationMs: trace.elapsedMs("termExtraction"),
    });

    const clarification = classifyNeedsClarification(questionText);
    if (clarification) {
      trace.setExpansion({ terms: [], durationMs: 0 });
      trace.setRetrieval({ candidates: [], durationMs: 0 });
      trace.setEvidence({
        sufficient: false,
        reason: "NEEDS_CLARIFICATION",
        cardsCount: 0,
        selectedCards: [],
      });
      trace.setAnswer({ durationMs: 0 });

      const response: AskResponse = {
        status: "NEEDS_CLARIFICATION",
        conversationId,
        turnIndex,
        message: clarification.message,
        suggestions: clarification.suggestions,
      };

      return NextResponse.json(withResponseDetails(response, trace, authz.user.role));
    }

    // 单轮问答走缓存
    const cacheKey = normalizedQuestion;
    if (authz.user.role !== "ADMIN" && responseMode === "think" && (!conversationId || turnIndex === 1)) {
      const cached = answerCache.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as AskResponse & { status: "ANSWERED" };
        return NextResponse.json({ ...parsed, conversationId, turnIndex });
      }
    }

    const askSlot = tryAcquireAskSlot(responseMode);
    if (!askSlot.ok) {
      return NextResponse.json(getAskBusyPayload(askSlot.reason), { status: 503 });
    }

    try {
    let expandedTerms: string[] = [];
    if (responseMode === "think") {
      trace.mark("expansion");
      expandedTerms = await expandQueryTerms(questionText);
      trace.setExpansion({ terms: expandedTerms, durationMs: trace.elapsedMs("expansion") });
    } else {
      trace.setExpansion({ terms: [], durationMs: 0 });
    }

    trace.mark("retrieval");
    const retrieval = await retrieveHybrid(questionText, 5, expandedTerms);
    trace.setRetrieval({
      candidates: retrieval.slice(0, 5).map((r) => ({
        id: r.card.id,
        summary: r.card.summary,
        score: r.score,
        terms: r.matchedTerms,
        verificationStatus: r.card.verificationStatus,
      })),
      durationMs: trace.elapsedMs("retrieval"),
    });

    trace.mark("evidence");
    const evidence = evaluateEvidence(retrieval);
    trace.setEvidence({
      sufficient: evidence.sufficient,
      reason: evidence.reason,
      cardsCount: evidence.cards.length,
      selectedCards: evidence.cards.map((r) => ({
        id: r.card.id,
        summary: r.card.summary,
        score: r.score,
        terms: r.matchedTerms,
        verificationStatus: r.card.verificationStatus,
      })),
    });

    if (responseMode === "cards" && evidence.sufficient) {
      trace.setAnswer({ durationMs: 0 });

      const question = await db.knowledgeQuestion.create({
        data: {
          askerId: authz.user?.id ?? null,
          originalText: questionText,
          normalizedText: normalizedQuestion,
          status: "ANSWERED",
          trace: trace.toJSON(),
        },
      });

      const response: AskResponse = {
        status: "CARDS_FOUND",
        questionId: question.id,
        cards: evidence.cards.map(toDirectCardDTO),
        message: "找到这些可引用卡片，先把原始材料浮上来给你看。",
      };

      return NextResponse.json(withResponseDetails(response, trace, authz.user.role));
    }

    if (!evidence.sufficient) {
      if (evidence.reason === "EMPTY") {
        const scopeDecision = classifyNoResult(questionText);
        if (scopeDecision === "OUT_OF_SCOPE") {
          const question = await db.knowledgeQuestion.create({
            data: {
              askerId: authz.user?.id ?? null,
              originalText: questionText,
              normalizedText: normalizedQuestion,
              status: "OUT_OF_SCOPE",
              trace: trace.toJSON(),
              conversationId,
              turnIndex,
            },
          });

          const response: AskResponse = {
            status: "OUT_OF_SCOPE",
            questionId: question.id,
            conversationId,
            turnIndex,
            message: "这个问题不在 NJU 知识库收录范围内。",
          };

          return NextResponse.json(withResponseDetails(response, trace, authz.user.role));
        }
      }

      const question = await db.knowledgeQuestion.create({
        data: {
          askerId: authz.user?.id ?? null,
          originalText: questionText,
          normalizedText: normalizedQuestion,
          status: "GAP_RECORDED",
          trace: trace.toJSON(),
          conversationId,
          turnIndex,
        },
      });

      const gap = await db.$transaction(async (tx) => {
        const existingGap = await tx.knowledgeGap.findFirst({
          where: {
            normalizedQuestion,
            status: { in: ["OPEN", "DUPLICATE"] },
          },
          orderBy: { createdAt: "asc" },
        });

        if (existingGap) return existingGap;

        try {
          return await tx.knowledgeGap.create({
            data: {
              questionId: question.id,
              originalQuestion: questionText,
              normalizedQuestion,
              status: "OPEN",
            },
          });
        } catch (err) {
          if (
            typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: string }).code === "P2002"
          ) {
            return tx.knowledgeGap.findFirstOrThrow({
              where: {
                normalizedQuestion,
                status: { in: ["OPEN", "DUPLICATE"] },
              },
              orderBy: { createdAt: "asc" },
            });
          }
          throw err;
        }
      });

      const response: AskResponse = {
        status: "GAP_RECORDED",
        questionId: question.id,
        gapId: gap.id,
        conversationId,
        turnIndex,
        message: GAP_MESSAGE,
      };

      return NextResponse.json(withResponseDetails(response, trace, authz.user.role));
    }

    trace.mark("answer");
    const groundedAnswer = await buildCardBoundedAnswer(questionText, evidence.cards, conversationHistory);
    trace.setAnswer({
      mode: groundedAnswer.answerMode,
      durationMs: trace.elapsedMs("answer"),
    });

    let answerText = groundedAnswer.answerText;
    if (groundedAnswer.answerMode === "FALLBACK") {
      answerText += "\n\n" + FEEDBACK_PROMPT;
    }

    const cardMap = new Map(evidence.cards.map((result) => [result.card.id, result.card]));
    const citations = groundedAnswer.citations
      .map((citation) => {
        const card = cardMap.get(citation.cardId);
        if (!card) return null;
        return { card, claimText: citation.claimText };
      })
      .filter((citation): citation is NonNullable<typeof citation> => Boolean(citation));

    if (citations.length === 0) {
      return NextResponse.json({ error: "答案缺少可用引用" }, { status: 500 });
    }

    const question = await db.knowledgeQuestion.create({
      data: {
        askerId: authz.user?.id ?? null,
        originalText: questionText,
        normalizedText: normalizedQuestion,
        status: "ANSWERED",
        trace: trace.toJSON(),
        conversationId,
        turnIndex,
        answer: {
          create: {
            answerText,
            answerMode: groundedAnswer.answerMode,
            citations: {
              create: citations.map((citation) => ({
                cardId: citation.card.id,
                claimText: citation.claimText,
              })),
            },
          },
        },
      },
      include: {
        answer: {
          include: {
            citations: true,
          },
        },
      },
    });

    const citationResponse: CitationDTO[] = citations.map((citation) => ({
      cardId: citation.card.id,
      summary: citation.card.summary,
      body: citation.card.body,
      sourceExcerpt: citation.card.sourceExcerpt,
      sourceDescription: citation.card.sourceDescription,
      sourceUrl: citation.card.sourceUrl,
      sourceType: citation.card.sourceType,
      verificationStatus: citation.card.verificationStatus,
      claimText: citation.claimText,
    }));

    const response: AskResponse = {
      status: "ANSWERED",
      questionId: question.id,
      conversationId,
      turnIndex,
      answer: answerText,
      answerMode: groundedAnswer.answerMode,
      fallbackReason: groundedAnswer.fallbackReason,
      structuredAnswer: groundedAnswer.structuredAnswer,
      citations: citationResponse,
    };
    const responseWithDetails = withResponseDetails(response, trace, authz.user.role);

    if (authz.user.role !== "ADMIN" && responseMode === "think" && (!conversationId || turnIndex === 1)) {
      answerCache.set(cacheKey, JSON.stringify(responseWithDetails));
    }

    return NextResponse.json(responseWithDetails);
    } finally {
      askSlot.release();
    }
  } catch (error) {
    console.error("Error answering knowledge question:", error);
    return NextResponse.json({ error: "知识问答失败" }, { status: 500 });
  }
}
