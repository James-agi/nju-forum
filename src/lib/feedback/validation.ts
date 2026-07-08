import { z } from "zod";

export const FEEDBACK_CATEGORIES = [
  "BUG",
  "SUGGESTION",
  "CONTENT",
  "MATERIAL",
  "OTHER",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  BUG: "功能异常 / Bug",
  SUGGESTION: "功能建议",
  CONTENT: "内容问题",
  MATERIAL: "提供资料",
  OTHER: "其他",
};

export const MATERIAL_TYPES = [
  "OFFICIAL_NOTICE",
  "COURSE_RESOURCE",
  "LIFE_GUIDE",
  "CONTENT_CORRECTION",
  "OTHER",
] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  OFFICIAL_NOTICE: "官方通知 / 政策",
  COURSE_RESOURCE: "课程资料 / 学习资料",
  LIFE_GUIDE: "校园生活经验",
  CONTENT_CORRECTION: "知识库纠错 / 补充",
  OTHER: "其他资料",
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

const optionalTrimmedString = (max: number, message: string) =>
  z.preprocess(
    (value) =>
      typeof value === "string" ? value.trim() || undefined : value,
    z.string().max(max, message).optional()
  );

export const materialSubmissionSchema = z.object({
  title: optionalTrimmedString(100, "资料标题过长"),
  materialType: z.enum(MATERIAL_TYPES, {
    error: "请选择资料类型",
  }),
  sourceUrl: z.preprocess(
    (value) =>
      typeof value === "string" ? value.trim() || undefined : value,
    z.url("资料链接格式不正确").max(500, "资料链接过长").optional()
  ),
  note: optionalTrimmedString(2000, "补充说明过长"),
  contact: optionalTrimmedString(200, "联系方式过长"),
});

export type MaterialSubmissionInput = z.infer<typeof materialSubmissionSchema>;
