"use client";

import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Brain, ChevronDown, ChevronUp, ExternalLink, FilePlus2, Search, Send, ThumbsDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { LinkifiedText, MarkdownText, SourceExcerptBlock } from "@/components/knowledge/source-excerpt";
import {
  SOURCE_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  type AskResponse,
  type CitationDTO,
  type DirectCardDTO,
} from "@/lib/knowledge/types";

type GroupedCitation = Omit<CitationDTO, "claimText"> & { claimTexts: string[] };
type AnswerMode = "cards" | "think";

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
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [answerMode, setAnswerMode] = useState<AnswerMode>("think");

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
        setError(data.error || "提问失败");
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
        <DirectCardsSurface response={answer} />
      )}

      {answer?.status === "ANSWERED" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">回答</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <MarkdownText text={answer.answer} className="text-sm leading-7" />
            <div className="space-y-3">
              <h2 className="text-sm font-medium">引用来源</h2>
              <CitationList citations={answer.citations} />
            </div>
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

function getCardPreview(body: string) {
  const text = body
    .replace(/[#*_>`\-\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 150 ? `${text.slice(0, 150)}...` : text;
}

function DirectCardsSurface({
  response,
}: {
  response: Extract<AskResponse, { status: "CARDS_FOUND" }>;
}) {
  return (
    <section className="card-bubble-surface relative overflow-hidden border bg-card/80 px-4 py-6 shadow-sm md:-mx-8 md:px-6 md:py-8">
      <div className="relative z-10 mx-auto mb-6 max-w-md text-center">
        <Badge variant="secondary" className="mb-3">
          <Search className="mr-1 h-3 w-3" />
          不思考
        </Badge>
        <p className="text-sm leading-6 text-muted-foreground">{response.message}</p>
      </div>

      <div className="relative z-10 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(9rem,0.36fr)_minmax(0,1fr)] md:gap-4">
        {response.cards.map((card, index) => (
          <DirectCardBubble
            key={card.cardId}
            card={card}
            index={index}
            className={
              index % 3 === 0
                ? "md:col-start-1"
                : index % 3 === 1
                  ? "md:col-start-3"
                  : "md:col-start-2"
            }
          />
        ))}
      </div>

      <div className="relative z-10 mt-5">
        <UnsolvedButton key={response.questionId} questionId={response.questionId} />
      </div>
    </section>
  );
}

function DirectCardBubble({
  card,
  index,
  className = "",
}: {
  card: DirectCardDTO;
  index: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleTerms = card.matchedTerms.slice(0, 4);

  return (
    <article
      className={`knowledge-card-bubble border bg-background/90 p-4 shadow-sm backdrop-blur ${className}`}
      style={{ "--bubble-index": index } as CSSProperties}
    >
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge variant="outline">{card.domainTag}</Badge>
        <Badge variant="outline">{SOURCE_TYPE_LABELS[card.sourceType]}</Badge>
        <Badge>{VERIFICATION_STATUS_LABELS[card.verificationStatus]}</Badge>
      </div>

      <h2 className="break-words text-sm font-semibold leading-6">
        <LinkifiedText text={card.summary} />
      </h2>
      <p className="mt-2 break-words text-sm leading-6 text-muted-foreground">
        <LinkifiedText text={getCardPreview(card.body)} />
      </p>

      {visibleTerms.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visibleTerms.map((term) => (
            <span
              key={term}
              className="border border-border px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground"
            >
              {term}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
          {expanded ? "收起卡片" : "展开卡片"}
        </Button>
        {card.sourceUrl && (
          <Button asChild variant="ghost" size="sm">
            <a href={card.sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              查看来源
            </a>
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <MarkdownText
            text={card.body}
            className="rounded-md bg-muted/40 p-3 text-sm leading-6"
          />
          {card.sourceExcerpt && (
            <SourceExcerptBlock sourceExcerpt={card.sourceExcerpt} />
          )}
          <p className="break-words text-sm text-muted-foreground">
            <LinkifiedText text={card.sourceDescription} />
          </p>
        </div>
      )}
    </article>
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
  const [showVerification, setShowVerification] = useState(false);

  const toggleVerification = () => {
    setShowVerification((value) => !value);
  };

  const expandVerification = () => {
    setShowVerification(true);
  };

  const handleCitationKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    expandVerification();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={showVerification}
      aria-label={`${showVerification ? "收起" : "核实"}知识卡片：${citation.summary}`}
      className="cursor-pointer rounded-md border p-3 transition hover:border-primary/60 hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      onClick={expandVerification}
      onKeyDown={handleCitationKeyDown}
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            toggleVerification();
          }}
        >
          {showVerification ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
          {showVerification ? "收起核实材料" : "核实这张卡片"}
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

      {showVerification && (
        <div className="mt-2 space-y-3 border-t pt-3">
          <MarkdownText
            text={citation.body}
            className="rounded-md bg-muted/50 p-3 text-sm leading-6"
          />
          {citation.sourceExcerpt && (
            <SourceExcerptBlock sourceExcerpt={citation.sourceExcerpt} />
          )}
          <div className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
            <span className="break-words text-muted-foreground">
              <LinkifiedText text={citation.sourceDescription} />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function UnsolvedButton({ questionId }: { questionId: string }) {
  const [state, setState] = useState<"idle" | "open" | "sending" | "done" | "error">("idle");
  const [note, setNote] = useState("");

  const submit = async (includeNote: boolean) => {
    if (state === "sending" || state === "done") return;
    setState("sending");
    const body = includeNote ? { questionId, note } : { questionId };
    try {
      const res = await fetch("/api/knowledge/answer-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <p className="border-t pt-4 text-sm text-muted-foreground">
        已记录，谢谢。你说的会帮作者补到卡片里。
      </p>
    );
  }

  if (state === "idle") {
    return (
      <div className="flex flex-col gap-1 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={() => setState("open")}
        >
          <ThumbsDown className="mr-2 h-4 w-4" />
          这没解决我的问题
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        className="min-h-20"
        placeholder="说一句哪里没解决？比如你其实想问的是…… 作者会照着补卡片。"
        disabled={state === "sending"}
      />
      <p className="text-xs text-muted-foreground">可选填，留空也能交。</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => submit(true)}
          disabled={state === "sending"}
        >
          {state === "sending" ? "提交中" : "提交反馈"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => submit(false)}
          disabled={state === "sending"}
        >
          跳过，直接提交
        </Button>
      </div>
      {state === "error" && (
        <p className="text-sm text-destructive">反馈提交失败，请稍后重试。</p>
      )}
    </div>
  );
}
