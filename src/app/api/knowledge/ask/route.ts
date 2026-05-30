import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireKnowledgeUser } from "@/lib/knowledge/authz";
import { buildCardBoundedAnswer } from "@/lib/knowledge/answer";
import { evaluateEvidence, retrieveKnowledgeCards } from "@/lib/knowledge/retrieval";
import { classifyP0Scope } from "@/lib/knowledge/scope";
import {
  askRequestSchema,
  formatValidationError,
  normalizeQuestionText,
} from "@/lib/knowledge/validation";
import type { AskResponse, CitationDTO } from "@/lib/knowledge/types";

export const dynamic = "force-dynamic";

const GAP_MESSAGE =
  "现有知识卡片证据不足，已申请作者补充或整理成知识卡片。P0 不会基于猜测作答，也不会自动代发论坛帖。";

export async function POST(req: Request) {
  try {
    const authz = await requireKnowledgeUser();
    if (!authz.ok) return authz.response;

    const payload = await req.json();
    const parsed = askRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatValidationError(parsed.error) },
        { status: 400 }
      );
    }

    const questionText = parsed.data.question;
    const normalizedQuestion = normalizeQuestionText(questionText);
    const scope = classifyP0Scope(questionText);

    if (!scope.inScope) {
      const question = await db.knowledgeQuestion.create({
        data: {
          askerId: authz.user.id,
          originalText: questionText,
          normalizedText: normalizedQuestion,
          status: "OUT_OF_SCOPE",
        },
      });

      const response: AskResponse = {
        status: "OUT_OF_SCOPE",
        questionId: question.id,
        message:
          scope.message ||
          "这个请求不属于 P0 的 NJU 信息沉淀范围。",
      };

      return NextResponse.json(response);
    }

    const retrieval = await retrieveKnowledgeCards(questionText);
    const evidence = evaluateEvidence(retrieval);

    if (!evidence.sufficient) {
      const question = await db.knowledgeQuestion.create({
        data: {
          askerId: authz.user.id,
          originalText: questionText,
          normalizedText: normalizedQuestion,
          status: "GAP_RECORDED",
        },
      });

      const existingGap = await db.knowledgeGap.findFirst({
        where: {
          normalizedQuestion,
          status: { in: ["OPEN", "DUPLICATE"] },
        },
        orderBy: { createdAt: "asc" },
      });

      const gap =
        existingGap ??
        (await db.knowledgeGap.create({
          data: {
            questionId: question.id,
            originalQuestion: questionText,
            normalizedQuestion,
            status: "OPEN",
          },
        }));

      const response: AskResponse = {
        status: "GAP_RECORDED",
        questionId: question.id,
        gapId: gap.id,
        message: GAP_MESSAGE,
      };

      return NextResponse.json(response);
    }

    const groundedAnswer = await buildCardBoundedAnswer(questionText, evidence.cards);
    const cardMap = new Map(evidence.cards.map((result) => [result.card.id, result.card]));
    const citations = groundedAnswer.citations
      .map((citation) => {
        const card = cardMap.get(citation.cardId);
        if (!card) return null;

        return {
          card,
          claimText: citation.claimText,
        };
      })
      .filter((citation): citation is NonNullable<typeof citation> => Boolean(citation));

    if (citations.length === 0) {
      return NextResponse.json({ error: "答案缺少可用引用" }, { status: 500 });
    }

    const question = await db.knowledgeQuestion.create({
      data: {
        askerId: authz.user.id,
        originalText: questionText,
        normalizedText: normalizedQuestion,
        status: "ANSWERED",
        answer: {
          create: {
            answerText: groundedAnswer.answerText,
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
      sourceDescription: citation.card.sourceDescription,
      sourceUrl: citation.card.sourceUrl,
      sourceType: citation.card.sourceType,
      verificationStatus: citation.card.verificationStatus,
      claimText: citation.claimText,
    }));

    const response: AskResponse = {
      status: "ANSWERED",
      questionId: question.id,
      answer: groundedAnswer.answerText,
      citations: citationResponse,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error answering knowledge question:", error);
    return NextResponse.json({ error: "知识问答失败" }, { status: 500 });
  }
}
