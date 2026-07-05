import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  password: z.string().min(6, "密码至少6位"),
});

export const registerSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
  name: z.string().min(2, "昵称至少2个字符").max(20, "昵称最多20个字符"),
  password: z.string().min(6, "密码至少6位"),
  confirmPassword: z.string().min(6, "密码至少6位"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次密码不一致",
  path: ["confirmPassword"],
});

export const postSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(100, "标题最多100个字符"),
  content: z.string().min(1, "内容不能为空"),
  sectionId: z.string().min(1, "请选择分区"),
  tags: z.array(z.string()).optional(),
});

export const replySchema = z.object({
  content: z.string().min(1, "回复内容不能为空").max(2000, "回复最多2000个字符"),
  parentId: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type PostInput = z.infer<typeof postSchema>;
export type ReplyInput = z.infer<typeof replySchema>;
