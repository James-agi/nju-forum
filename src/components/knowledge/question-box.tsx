"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronUp, ExternalLink, FilePlus2, Send, ThumbsDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  SOURCE_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  type AskResponse,
  type CitationDTO,
} from "@/lib/knowledge/types";

type GroupedCitation = Omit<CitationDTO, "claimText"> & { claimTexts: string[] };

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
        body: JSON.stringify({ question: trimmedQuestion }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "提问失败");
        return;
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
      <Card>
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Enter 提交，Shift+Enter 换行。</p>
            <Button type="button" onClick={askQuestion} disabled={loading || !question.trim()}>
              <Send className="mr-2 h-4 w-4" />
              {loading ? "检索中" : "提交问题"}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {answer?.status === "ANSWERED" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">回答</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="whitespace-pre-wrap text-sm leading-7">{answer.answer}</p>
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
  const [showBody, setShowBody] = useState(false);
  const [showExcerpt, setShowExcerpt] = useState(false);

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge variant="outline">{SOURCE_TYPE_LABELS[citation.sourceType]}</Badge>
        <Badge>{VERIFICATION_STATUS_LABELS[citation.verificationStatus]}</Badge>
      </div>
      <p className="text-sm font-medium">{citation.summary}</p>

      <ul className="mt-2 space-y-1">
        {citation.claimTexts.map((claim, index) => (
          <li
            key={index}
            className="border-l-2 border-muted-foreground/30 pl-3 text-sm text-muted-foreground"
          >
            {claim}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowBody((value) => !value)}
        >
          {showBody ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
          {showBody ? "收起正文" : "展开正文"}
        </Button>
        {citation.sourceExcerpt && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowExcerpt((value) => !value)}
          >
            {showExcerpt ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
            {showExcerpt ? "收起原文摘录" : "展开原文摘录"}
          </Button>
        )}
      </div>

      {showBody && (
        <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-6">
          {citation.body}
        </p>
      )}
      {showExcerpt && citation.sourceExcerpt && (
        <div className="mt-2 rounded-md bg-muted/50 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">来源原文摘录</p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {citation.sourceExcerpt}
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
        <span className="text-muted-foreground">{citation.sourceDescription}</span>
        {citation.sourceUrl && (
          <Button asChild variant="ghost" size="sm">
            <a href={citation.sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              查看来源
            </a>
          </Button>
        )}
      </div>
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
