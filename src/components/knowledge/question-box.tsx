"use client";

import { useState, type KeyboardEvent } from "react";
import { ExternalLink, FilePlus2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  SOURCE_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  type AskResponse,
} from "@/lib/knowledge/types";

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
              {answer.citations.map((citation) => (
                <div key={`${citation.cardId}-${citation.claimText}`} className="rounded-md border p-3">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{SOURCE_TYPE_LABELS[citation.sourceType]}</Badge>
                    <Badge>{VERIFICATION_STATUS_LABELS[citation.verificationStatus]}</Badge>
                  </div>
                  <p className="text-sm font-medium">{citation.summary}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{citation.claimText}</p>
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
              ))}
            </div>
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
