"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  KNOWLEDGE_DOMAIN_TAGS,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPES,
  VERIFICATION_STATUS_LABELS,
  VERIFICATION_STATUSES,
  type KnowledgeCardDTO,
  type SourceTypeValue,
  type VerificationStatusValue,
} from "@/lib/knowledge/types";

interface CardEditorProps {
  card?: KnowledgeCardDTO | null;
  onSaved: (card: KnowledgeCardDTO) => void;
}

const emptyForm = {
  summary: "",
  body: "",
  sourceExcerpt: "",
  sourceUrl: "",
  sourceDescription: "",
  sourceType: "OFFICIAL" as SourceTypeValue,
  verificationStatus: "VERIFIED" as VerificationStatusValue,
  domainTag: "新生入学",
};

const CUSTOM_DOMAIN_TAG = "__CUSTOM_DOMAIN_TAG__";

function isKnownDomainTag(value: string) {
  return KNOWLEDGE_DOMAIN_TAGS.includes(value as (typeof KNOWLEDGE_DOMAIN_TAGS)[number]);
}

export function CardEditor({ card, onSaved }: CardEditorProps) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const domainTagSelectValue = isKnownDomainTag(form.domainTag)
    ? form.domainTag
    : CUSTOM_DOMAIN_TAG;

  useEffect(() => {
    if (card) {
      setForm({
        summary: card.summary,
        body: card.body,
        sourceExcerpt: card.sourceExcerpt ?? "",
        sourceUrl: card.sourceUrl ?? "",
        sourceDescription: card.sourceDescription,
        sourceType: card.sourceType,
        verificationStatus: card.verificationStatus,
        domainTag: card.domainTag,
      });
      return;
    }

    setForm(emptyForm);
  }, [card]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveCard = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        card ? `/api/knowledge/cards/${card.id}` : "/api/knowledge/cards",
        {
          method: card ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }

      onSaved(data);
      if (!card) setForm(emptyForm);
    } catch {
      setError("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{card ? "编辑知识卡片" : "新建知识卡片"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="summary">摘要</Label>
            <Input
              id="summary"
              value={form.summary}
              onChange={(event) => updateField("summary", event.target.value)}
              placeholder="一句话概括这张卡片"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="body">正文</Label>
            <Textarea
              id="body"
              value={form.body}
              onChange={(event) => updateField("body", event.target.value)}
              className="min-h-36"
              placeholder="只写一个独立知识点，保留可用于回答的完整内容"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="sourceExcerpt">原文摘录（可空，仅展示用，不参与问答检索）</Label>
            <Textarea
              id="sourceExcerpt"
              value={form.sourceExcerpt}
              onChange={(event) => updateField("sourceExcerpt", event.target.value)}
              className="min-h-28"
              placeholder="逐字粘贴来源原文片段，供用户核对溯源；留空则不显示原文板块"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceDescription">来源说明</Label>
            <Input
              id="sourceDescription"
              value={form.sourceDescription}
              onChange={(event) => updateField("sourceDescription", event.target.value)}
              placeholder="如：南京大学官方说明页 / 问了某学长"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceUrl">来源链接</Label>
            <Input
              id="sourceUrl"
              value={form.sourceUrl}
              onChange={(event) => updateField("sourceUrl", event.target.value)}
              placeholder="可为空"
            />
          </div>

          <div className="space-y-2">
            <Label>来源类型</Label>
            <Select
              value={form.sourceType}
              onValueChange={(value) => updateField("sourceType", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {SOURCE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>核实状态</Label>
            <Select
              value={form.verificationStatus}
              onValueChange={(value) => updateField("verificationStatus", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERIFICATION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {VERIFICATION_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>知识分区 / 标签</Label>
            <Select
              value={domainTagSelectValue}
              onValueChange={(value) => {
                if (value === CUSTOM_DOMAIN_TAG) {
                  if (isKnownDomainTag(form.domainTag)) updateField("domainTag", "");
                  return;
                }

                updateField("domainTag", value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择知识分区" />
              </SelectTrigger>
              <SelectContent>
                {KNOWLEDGE_DOMAIN_TAGS.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_DOMAIN_TAG}>自定义标签</SelectItem>
              </SelectContent>
            </Select>
            {domainTagSelectValue === CUSTOM_DOMAIN_TAG && (
              <Input
                id="domainTag"
                value={form.domainTag}
                onChange={(event) => updateField("domainTag", event.target.value)}
                placeholder="输入自定义标签"
              />
            )}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end">
          <Button onClick={saveCard} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "保存中" : "保存卡片"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
