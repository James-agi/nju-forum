"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { BookOpen, Brain, ExternalLink, FilePlus2, Search, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LinkifiedText, MarkdownText } from "@/components/knowledge/source-excerpt";
import { FloatingCardsField } from "@/components/knowledge/floating-cards-field";
import { UnsolvedButton } from "@/components/knowledge/unsolved-button";
import {
  restoreKnowledgeAskScrollPosition,
  saveKnowledgeAskScrollPosition,
} from "@/lib/knowledge/ask-page-session";
import {
  SOURCE_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  type AskResponse,
  type CitationDTO,
  type KnowledgeTrace,
  type ResultExplanation,
  type StructuredAnswer,
  type StructuredAnswerBlockRole,
} from "@/lib/knowledge/types";

type GroupedCitation = Omit<CitationDTO, "claimText"> & { claimTexts: string[] };
type AnswerMode = "cards" | "think";
type AskErrorResponse = { code?: string; error?: string };
type StoredQuestionBoxState = {
  question: string;
  answer: AskResponse | null;
  conversationId: string | null;
  answerMode: AnswerMode;
};

const QUESTION_BOX_STORAGE_KEY = "nju-knowledge-question-box-state";

function readStoredQuestionBoxState(): StoredQuestionBoxState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(QUESTION_BOX_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredQuestionBoxState>;
    if (parsed.answerMode !== "cards" && parsed.answerMode !== "think") return null;

    return {
      question: typeof parsed.question === "string" ? parsed.question : "",
      answer: parsed.answer ?? null,
      conversationId:
        typeof parsed.conversationId === "string" ? parsed.conversationId : null,
      answerMode: parsed.answerMode,
    };
  } catch {
    return null;
  }
}

function getAskErrorMessage(data: AskErrorResponse) {
  if (data.code === "RATE_LIMITED") {
    return "你问得有点快，稍等几秒再试。";
  }
  if (data.code === "ASK_THINK_BUSY") {
    return "当前思考回答人数较多，请稍后再试。你也可以先切到「不思考」查看相关知识卡片。";
  }
  if (data.code === "ASK_CARDS_BUSY") {
    return "当前找卡片人数较多，请稍后再试。";
  }
  if (data.code === "ASK_BUSY") {
    return "当前问答人数较多，请稍后再试。你也可以先查看相关知识卡片。";
  }
  return data.error || "提问失败";
}

function groupCitations(citations: CitationDTO[]): GroupedCitation[] {
  const map = new Map<string, GroupedCitation>();
  for (const citation of citations) {
    const existing = map.get(citation.cardId);
    if (existing) {
      if (!existing.claimTexts.includes(citation.claimText)) {
        existing.claimTexts.push(citation.claimText);
      }
      continue;
    }
    const { claimText, ...rest } = citation;
    map.set(citation.cardId, { ...rest, claimTexts: [claimText] });
  }
  return Array.from(map.values());
}

export function QuestionBox() {
  const restoredRef = useRef(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [answerMode, setAnswerMode] = useState<AnswerMode>("think");

  useEffect(() => {
    const stored = readStoredQuestionBoxState();
    if (stored) {
      setQuestion(stored.question);
      setAnswer(stored.answer);
      setConversationId(stored.conversationId);
      setAnswerMode(stored.answerMode);
      restoreKnowledgeAskScrollPosition();
    }
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", saveKnowledgeAskScrollPosition);

    return () => {
      window.removeEventListener("pagehide", saveKnowledgeAskScrollPosition);
      saveKnowledgeAskScrollPosition();
    };
  }, []);

  useEffect(() => {
    if (!restoredRef.current) {
      restoredRef.current = true;
      return;
    }

    try {
      if (!question.trim() && !answer && !conversationId) {
        window.sessionStorage.removeItem(QUESTION_BOX_STORAGE_KEY);
        return;
      }

      const state: StoredQuestionBoxState = {
        question,
        answer,
        conversationId,
        answerMode,
      };
      window.sessionStorage.setItem(QUESTION_BOX_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Session restore is best-effort; asking should still work if storage is blocked.
    }
  }, [answer, answerMode, conversationId, question]);

  const askQuestion = async () => {
    const trimmedQuestion = question.trim();
    if (loading || !trimmedQuestion) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const res = await fetch("/api/knowledge/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          mode: answerMode,
          ...(answerMode === "think" && conversationId ? { conversationId } : {}),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(getAskErrorMessage(data));
        return;
      }

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      setAnswer(data);
    } catch {
      setError("提问失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    void askQuestion();
  };

  return (
    <div className="space-y-4">
      <Card className="relative z-10">
        <CardHeader>
          <CardTitle className="text-lg">提问</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleQuestionKeyDown}
            className="min-h-32"
            placeholder="输入一个具体的 NJU 信息问题，例如：三三制怎么修？"
          />
          <div className="grid grid-cols-2 gap-1 border bg-muted/30 p-1">
            <ModeButton
              active={answerMode === "cards"}
              icon={<Search className="h-4 w-4" />}
              title="不思考"
              subtitle="只浮出卡片"
              onClick={() => setAnswerMode("cards")}
            />
            <ModeButton
              active={answerMode === "think"}
              icon={<Brain className="h-4 w-4" />}
              title="思考"
              subtitle="整理成回答"
              onClick={() => setAnswerMode("think")}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Enter 提交，Shift+Enter 换行。</p>
            <Button type="button" onClick={askQuestion} disabled={loading || !question.trim()}>
              <Send className="mr-2 h-4 w-4" />
              {loading ? (answerMode === "cards" ? "找卡片中" : "检索中") : (answerMode === "cards" ? "找相关卡片" : "提交问题")}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">回答</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {answerMode === "think" ? (
              <div className="space-y-3">
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                正在把相关卡片从知识库里捞出来。
              </p>
            )}
            <div className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-md border bg-muted" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {answer?.status === "CARDS_FOUND" && (
        <FloatingCardsField
          key={answer.questionId}
          message={answer.message}
          cards={answer.cards}
          questionId={answer.questionId}
        />
      )}

      {answer?.status === "ANSWERED" && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <CardTitle className="text-base">回答</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-5">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={answer.answerMode === "FALLBACK" ? "outline" : "secondary"}>
                  {answer.answerMode === "FALLBACK" ? "相关知识片段" : "基于知识卡片"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {answer.citations.length} 条引用
                </span>
              </div>
              {answer.answerMode === "FALLBACK" && (
                <div className="border-l-4 border-l-amber-500 bg-amber-500/10 px-4 py-3 text-sm leading-6">
                  <p className="font-medium">模型整理失败，以下展示知识库命中的相关片段。</p>
                  <p className="mt-1 text-muted-foreground">
                    这些片段未经模型整合，只代表当前匹配到的卡片内容。
                  </p>
                </div>
              )}
              {answer.answerMode === "FALLBACK" ? (
                <FallbackFragments answerText={answer.answer} citations={answer.citations} />
              ) : answer.structuredAnswer ? (
                <StructuredAnswerView answer={answer.structuredAnswer} />
              ) : (
                <MarkdownText
                  text={answer.answer}
                  className="max-w-none text-[15px] leading-8 text-foreground [&_li]:my-1.5 [&_ol]:space-y-1 [&_p]:my-2 [&_ul]:space-y-1"
                />
              )}
            </section>
            {answer.answerMode !== "FALLBACK" && (
              <div className="space-y-3 border-t pt-4">
                <h2 className="text-sm font-medium">依据卡片</h2>
                <CitationList citations={answer.citations} />
              </div>
            )}
            <UnsolvedButton key={answer.questionId} questionId={answer.questionId} />
          </CardContent>
        </Card>
      )}

      {answer?.status === "GAP_RECORDED" && (
        <Card>
          <CardContent className="p-5">
            <Badge variant="secondary" className="mb-3">
              <FilePlus2 className="mr-1 h-3 w-3" />
              已申请补充
            </Badge>
            <p className="text-sm leading-6 text-muted-foreground">{answer.message}</p>
          </CardContent>
        </Card>
      )}

      {answer?.status === "OUT_OF_SCOPE" && (
        <Card>
          <CardContent className="p-5">
            <Badge variant="outline" className="mb-3">不属 P0</Badge>
            <p className="text-sm leading-6 text-muted-foreground">{answer.message}</p>
          </CardContent>
        </Card>
      )}

      {answer?.status === "NEEDS_CLARIFICATION" && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <Badge variant="secondary">请补充问题</Badge>
            <p className="text-sm leading-6 text-muted-foreground">{answer.message}</p>
            <div className="flex flex-wrap gap-2">
              {answer.suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuestion(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {answer?.explanation && <ResultExplanationPanel explanation={answer.explanation} />}
      {answer?.trace && <DebugTracePanel trace={answer.trace} />}
    </div>
  );
}

function ModeButton({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-14 items-center gap-2 px-3 py-2 text-left transition ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-border">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs">{subtitle}</span>
      </span>
    </button>
  );
}

function ResultExplanationPanel({ explanation }: { explanation: ResultExplanation }) {
  return (
    <details className="rounded-md border bg-background">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        为什么是这些结果
      </summary>
      <div className="space-y-4 border-t p-4 text-sm">
        <DebugSection title="系统理解到的关键词">
          <p className="break-words text-muted-foreground">
            {explanation.keywords.join(" / ") || "无"}
          </p>
        </DebugSection>

        {explanation.appliedAliases.length > 0 && (
          <DebugSection title="相关理解">
            <div className="space-y-2">
              {explanation.appliedAliases.map((alias, index) => (
                <p key={index} className="break-words text-muted-foreground">
                  {alias.triggers.join(" / ")} → {alias.targets.join(" / ")}
                </p>
              ))}
            </div>
          </DebugSection>
        )}

        <DebugSection title="选卡依据">
          <p className="text-muted-foreground">
            {explanation.evidence.sufficient
              ? `已有 ${explanation.evidence.cardCount} 张知识卡片可作为依据。`
              : "现有知识卡片还不足以直接回答这个问题。"}
          </p>
          {explanation.evidence.selectedCards.length > 0 && (
            <div className="mt-2 space-y-2">
              {explanation.evidence.selectedCards.map((card, index) => (
                <div key={`${card.summary}-${index}`} className="rounded border bg-muted/20 p-2">
                  <p className="break-words font-medium">{card.summary}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    命中：{card.matchedTerms.join(" / ") || "无命中词"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DebugSection>
      </div>
    </details>
  );
}

function DebugTracePanel({ trace }: { trace: KnowledgeTrace }) {
  const aliases = trace.termExtraction?.aliases || [];
  const candidates = trace.retrieval?.candidates || [];
  const selectedCards = trace.evidence?.selectedCards || [];

  return (
    <details className="rounded-md border bg-muted/20">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        调试详情
      </summary>
      <div className="space-y-4 border-t p-4 text-sm">
        <DebugSection title="抽词">
          <p className="break-words text-muted-foreground">
            {(trace.termExtraction?.terms || []).join(" / ") || "无"}
          </p>
        </DebugSection>

        <DebugSection title="别名决策">
          {aliases.length > 0 ? (
            <div className="space-y-2">
              {aliases.map((alias, index) => (
                <div key={index} className="rounded border bg-background p-2">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant={alias.status === "APPLIED" ? "default" : "secondary"}>
                      {alias.status === "APPLIED" ? "已应用" : "已拒绝"}
                    </Badge>
                    {alias.reason && <span className="text-xs text-muted-foreground">{alias.reason}</span>}
                  </div>
                  <p className="break-words text-xs text-muted-foreground">
                    触发：{alias.matchedTriggers.join(" / ")}
                  </p>
                  <p className="break-words text-xs text-muted-foreground">
                    目标：{alias.targets.join(" / ")}
                  </p>
                  {alias.requireAny && (
                    <p className="break-words text-xs text-muted-foreground">
                      需要上下文：{alias.requireAny.join(" / ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">无别名触发</p>
          )}
        </DebugSection>

        <DebugSection title="候选卡">
          {candidates.length > 0 ? (
            <ol className="space-y-2">
              {candidates.map((candidate) => (
                <li key={candidate.id} className="rounded border bg-background p-2">
                  <p className="break-words font-medium">{candidate.summary || candidate.id}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    score {candidate.score} · {candidate.terms.join(" / ") || "无命中词"}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground">无候选卡</p>
          )}
        </DebugSection>

        <DebugSection title="证据">
          <p className="text-muted-foreground">
            {trace.evidence?.sufficient ? "通过" : "未通过"}
            {trace.evidence?.reason ? ` · ${trace.evidence.reason}` : ""}
            {typeof trace.evidence?.cardsCount === "number" ? ` · ${trace.evidence.cardsCount} 张` : ""}
          </p>
          {selectedCards.length > 0 && (
            <ol className="mt-2 space-y-2">
              {selectedCards.map((card) => (
                <li key={card.id} className="rounded border bg-background p-2">
                  <p className="break-words font-medium">{card.summary}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    score {card.score} · {card.terms.join(" / ") || "无命中词"}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </DebugSection>
      </div>
    </details>
  );
}

function DebugSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

const STRUCTURED_BLOCK_ROLE_LABELS: Record<StructuredAnswerBlockRole, string> = {
  answer: "回答",
  step: "步骤",
  requirement: "条件",
  option: "选项",
  risk: "注意",
  action: "建议",
  gap: "缺口",
  note: "提示",
};

const STRUCTURED_BLOCK_ROLE_STYLES: Record<StructuredAnswerBlockRole, string> = {
  answer: "border-l-primary bg-primary/5",
  step: "border-l-blue-500 bg-blue-500/5",
  requirement: "border-l-amber-500 bg-amber-500/5",
  option: "border-l-violet-500 bg-violet-500/5",
  risk: "border-l-destructive bg-destructive/5",
  action: "border-l-emerald-500 bg-emerald-500/5",
  gap: "border-l-orange-500 bg-orange-500/5",
  note: "border-l-muted-foreground/50 bg-muted/30",
};

function StructuredAnswerView({ answer }: { answer: StructuredAnswer }) {
  return (
    <div className="space-y-4">
      <p className="text-base font-medium leading-7">
        <LinkifiedText text={answer.headline} />
      </p>
      <div className="space-y-3">
        {answer.blocks.map((block, index) => (
          <section
            key={`${block.role}-${block.title}-${index}`}
            className={`border-l-4 px-4 py-3 ${STRUCTURED_BLOCK_ROLE_STYLES[block.role]}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={block.role === "gap" || block.role === "risk" ? "outline" : "secondary"}>
                {STRUCTURED_BLOCK_ROLE_LABELS[block.role]}
              </Badge>
              <h2 className="text-sm font-semibold">{block.title}</h2>
            </div>
            <ul className="space-y-2">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="break-words text-sm leading-7 text-muted-foreground">
                  <LinkifiedText text={item} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function FallbackFragments({
  answerText,
  citations,
}: {
  answerText: string;
  citations: CitationDTO[];
}) {
  return (
    <div className="space-y-4">
      <MarkdownText
        text={answerText}
        className="max-w-none text-sm leading-7 text-muted-foreground [&_p]:my-2"
      />
      <div className="space-y-3 border-t pt-4">
        <h2 className="text-sm font-medium">相关片段</h2>
        <CitationList citations={citations} />
      </div>
    </div>
  );
}

function CitationList({ citations }: { citations: CitationDTO[] }) {
  const grouped = useMemo(() => groupCitations(citations), [citations]);
  return (
    <div className="space-y-3">
      {grouped.map((citation) => (
        <CitationItem key={citation.cardId} citation={citation} />
      ))}
    </div>
  );
}

function CitationItem({ citation }: { citation: GroupedCitation }) {
  return (
    <div
      className="rounded-md border bg-background p-3 transition hover:border-primary/60 hover:bg-muted/20"
    >
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge variant="outline">{SOURCE_TYPE_LABELS[citation.sourceType]}</Badge>
        <Badge>{VERIFICATION_STATUS_LABELS[citation.verificationStatus]}</Badge>
      </div>
      <p className="break-words text-sm font-medium">
        <LinkifiedText text={citation.summary} />
      </p>

      <ul className="mt-2 space-y-1">
        {citation.claimTexts.map((claim, index) => (
          <li
            key={index}
            className="break-words border-l-2 border-muted-foreground/30 pl-3 text-sm text-muted-foreground"
          >
            <LinkifiedText text={claim} />
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link
            href={`/knowledge/cards/${citation.cardId}`}
            onClick={(event) => {
              event.stopPropagation();
              saveKnowledgeAskScrollPosition();
            }}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            查看卡片
          </Link>
        </Button>
        {citation.sourceUrl && (
          <Button asChild variant="ghost" size="sm">
            <a
              href={citation.sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              查看来源
            </a>
          </Button>
        )}
      </div>

    </div>
  );
}
