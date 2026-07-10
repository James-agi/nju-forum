# Part A — 基础改动：技术细节

## A1. 改名「南大论坛」→「知南」

涉及文件：
- `src/app/forum/page.tsx` — 页面大标题、metadata
- `src/components/layout/navbar.tsx` — logo/品牌名
- `src/app/layout.tsx` — `<title>` / metadata
- 其他出现「南大论坛」的地方全局替换

改法：纯文本替换，不涉及逻辑变更。

## A2. 测试数据 seed 脚本

创建 `prisma/seed-posts.ts`，插入 18 条帖子：
- 覆盖 5 个 section，每个 section 3-4 条
- 每条帖子 200-400 字正文（中文，模拟真实讨论）
- 随机分配 tags（从现有 tag 表选）
- 部分帖子设置 pinned=true（2-3 条）
- 部分帖子附带 replies 和 favorites 记录（用于热帖排序测试）

执行方式：`npx tsx prisma/seed-posts.ts`

## A3. 恢复登录页

检查步骤：
1. 查 git log 找登录页历史版本（带背景动效的）
2. 若有备份 dump 文件中的代码，从中提取
3. 若都没有，根据用户描述重建：深色背景 + 粒子/光效动画 + 居中登录卡片

登录页路径：`src/app/(auth)/login/page.tsx`
