import { z } from "zod";

export const FEEDBACK_CATEGORIES = [
  "BUG",
  "SUGGESTION",
  "CONTENT",
  "OTHER",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  BUG: "功能异常 / Bug",
  SUGGESTION: "功能建议",
  CONTENT: "内容问题",
  OTHER: "其他",
};

export const websiteFeedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES, {
    error: "请选择反馈类型",
  }),
  content: z
    .string({ error: "反馈内容不能为空" })
    .trim()
    .min(1, "反馈内容不能为空")
    .max(2000, "反馈内容过长（最多 2000 字）"),
  contact: z.preprocess(
    (value) =>
      typeof value === "string" ? value.trim() || undefined : value,
    z.string().max(200, "联系方式过长").optional()
  ),
});

export type WebsiteFeedbackInput = z.infer<typeof websiteFeedbackSchema>;
