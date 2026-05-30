import { z } from "zod";
import {
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
} from "@/lib/knowledge/types";

const trimmedRequired = (name: string, max = 2000) =>
  z
    .string({ error: `${name}不能为空` })
    .trim()
    .min(1, `${name}不能为空`)
    .max(max, `${name}过长`);

const optionalUrl = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().url("来源链接必须是有效 URL").max(2048).optional()
);

const optionalId = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().optional()
);

const GAP_UPDATE_STATUSES = ["HANDLED", "DUPLICATE", "OUT_OF_SCOPE"] as const;

export const cardCreateSchema = z.object({
  summary: trimmedRequired("摘要", 200),
  body: trimmedRequired("正文", 12000),
  sourceUrl: optionalUrl,
  sourceDescription: trimmedRequired("来源说明", 500),
  sourceType: z.enum(SOURCE_TYPES),
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  domainTag: trimmedRequired("领域标签", 80),
});

export const cardUpdateSchema = cardCreateSchema.partial().extend({
  archive: z.boolean().optional(),
});

export const askRequestSchema = z.object({
  question: trimmedRequired("问题", 500).min(2, "问题至少需要 2 个字符"),
});

export const gapUpdateSchema = z
  .object({
    status: z.enum(GAP_UPDATE_STATUSES),
    linkedCardId: optionalId,
    duplicateOfId: optionalId,
  })
  .superRefine((value, ctx) => {
    if (value.status === "HANDLED" && !value.linkedCardId) {
      ctx.addIssue({
        code: "custom",
        path: ["linkedCardId"],
        message: "标记已处理时需要关联解决该缺口的卡片",
      });
    }

    if (value.status === "DUPLICATE" && !value.duplicateOfId) {
      ctx.addIssue({
        code: "custom",
        path: ["duplicateOfId"],
        message: "标记重复时需要选择重复来源",
      });
    }
  });

export function normalizeQuestionText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[，。！？、；：“”‘’（）【】《》]/g, "")
    .replace(/[^0-9a-zA-Z\u3400-\u9fff\s]/g, "")
    .trim();
}

export function getPagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const limit = 20;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

export function formatValidationError(error: z.ZodError) {
  return error.issues.map((issue) => issue.message).join("；");
}
