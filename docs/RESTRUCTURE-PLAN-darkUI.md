# nju-forum 暗色内容系统改造方案

> 依据 `artifacts/meeting_01_ui_review` 提炼的设计系统，把 nju-forum 从默认亮色 shadcn 改造成"暗色内容系统"。
> 所有色值来自 25 张截图的真实像素抽取，非主观估计。

## 0. 现状勘察结论（已读代码确认）

- **技术栈**：Next.js App Router + shadcn/ui + Tailwind，`darkMode: ["class"]`，全套 HSL 语义 token。
- **当前是亮色**：`<html lang="zh-CN">` 无 `dark` class，`:root` 白底。这是头号改造点。
- **硬编码颜色极少**：全 `src` 只有 2 处（`sheet.tsx`、`dialog.tsx` 的 `bg-black/80` 遮罩），其余 100% 走语义 token。**改 token 层即可全局换肤，风险极低。**
- **骨架已有雏形**：`forum/page.tsx` 已用 `Badge variant=outline` 当 section-label、`h1` 大标题、`muted-foreground` 副说明、统计卡、`hover:border-foreground/20` 卡 hover。缺的不是结构，是令牌没调到位（亮色 / 圆角 0.5rem / 灰阶步长太大 / 统计卡用图标非巨数字）。
- **字体**：仅 `Inter`，无中文字体优化。个人站强调"中英混排赏心悦目"，需补中文字体栈。

## 1. 设计令牌（实测像素 → CSS 变量）

shadcn 用 HSL。近黑中性灰 `#080808`≈`hsl(0 0% 3%)`，`#101010`≈`4%`，`#181818`≈`9%`，`#202020`≈`13%`，`#f0f0f0`≈`94%`。
关键：**相邻层只差约 3-5% 亮度**，这是"安静感"的数学来源。

### 1.1 改写 `.dark` 变量（globals.css）

| 变量 | 新值 (HSL) | 实测来源 |
|---|---|---|
| `--background` | `0 0% 3%` | `#080808` 全站统治色 |
| `--foreground` | `0 0% 94%` | `#f0f0f0` 非纯白 |
| `--card` | `0 0% 6%` | `#101010` 抬升=背景+一阶 |
| `--card-foreground` | `0 0% 94%` | — |
| `--popover` | `0 0% 4%` | 略深于卡 |
| `--popover-foreground` | `0 0% 94%` | — |
| `--primary` | `0 0% 94%` | 主操作=亮文字（暗底反白按钮） |
| `--primary-foreground` | `0 0% 6%` | — |
| `--secondary` | `0 0% 9%` | `#181818` hover/次级面 |
| `--secondary-foreground` | `0 0% 94%` | — |
| `--muted` | `0 0% 9%` | `#181818` |
| `--muted-foreground` | `0 0% 60%` | 列表元信息中灰 |
| `--accent` | `0 0% 13%` | `#202020` 更高层/hover 填充 |
| `--accent-foreground` | `0 0% 94%` | — |
| `--border` | `0 0% 13%` | `#202020` 发丝线 |
| `--input` | `0 0% 13%` | 暗底细边输入框 |
| `--ring` | `0 0% 40%` | 中性 focus 环（非蓝） |
| `--radius` | `0rem` | 圆角预算=1，详见 1.3 |

### 1.2 状态色（唯一允许的彩色）

个人站页面级彩色极少，只有状态点和媒体封面。新增语义变量：

| 变量 | 值 | 用途 |
|---|---|---|
| `--status-active` | `142 60% 45%`≈`#33ba6e` | 运行中/在线/已完结（绿） |
| `--status-progress` | `28 55% 48%`≈`#b8763c` | 进行中/进度（琥珀） |
| `--status-info` | `222 55% 52%`≈`#3b64ba` | 链接/信息（蓝，迁移案例同款，克制使用） |

> 实测说明：绿 `#33ba6e`、琥珀 `#b8763c`、蓝 `#3b64ba` 是从迁移案例页内容区抽出的真实强调色。蓝色仅在"放宽约束"时出现，论坛里保留给链接/信息态。

### 1.3 圆角预算 = 1

个人站"全站唯一显著圆角物是顶栏"。落地策略：
- 全局 `--radius: 0rem`（卡片、输入框、按钮变方角）。
- **唯一例外**：顶栏 navbar 容器手动加 `rounded-b-xl` 或外悬浮 `rounded-2xl`，成为"控制器"。
- Badge 的 `rounded-full` 改 `rounded-none`（状态标签变方）；头像 Avatar 保留圆形（人脸是内容不是 chrome）。

### 1.4 字体栈（中英混排）

`layout.tsx` 给 body 加中文字体栈，英文走 Inter、中文走系统优先的思源/苹方：
```
font-family: Inter, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
```
英文行距松（`leading-7`）、中文正文紧（`leading-6`），对应实测"英文行距更松、中文更紧凑"。

## 2. 全局接入暗色

两种方式，二选一：
- **方案 A（推荐，简单直接）**：`layout.tsx` 的 `<html>` 加 `className="dark"`，强制全站暗色。论坛定位单一主题，不需要亮/暗切换。
- **方案 B（保留切换能力）**：装 `next-themes`，默认 `dark`，设置页给"减少动效/亮读模式"开关。工作量大，建议二期。

一期走 A。

## 3. 组件改造清单（按"令牌驱动"分层）

### 3.1 零改动即生效（改 token 自动带动）
这些组件全走语义 token，改 `.dark` 变量后自动变暗，**无需碰代码**：
`card.tsx`、`post-list-item.tsx`、`button.tsx`、`input.tsx`、`textarea.tsx`、`select.tsx`、`table.tsx`、`separator.tsx`、`tabs.tsx`、`dropdown-menu.tsx`、所有 `*/page.tsx` 的语义 token 部分。

### 3.2 需小改（圆角/硬编码）
| 文件 | 改动 |
|---|---|
| `globals.css` | 重写 `.dark` 变量 + 新增状态色 + `--radius:0` |
| `layout.tsx` | `<html className="dark">` + 中文字体栈 |
| `badge.tsx` | `rounded-full` → `rounded-none`；新增 `status` variant（用状态色） |
| `navbar.tsx` | 容器加圆角成"控制器"；高度/留白微调 |
| `sheet.tsx`、`dialog.tsx` | `bg-black/80` 保留（遮罩本就该黑），确认暗色下不突兀即可 |

### 3.3 需新建（个人站特有组件，二期按需）
| 组件 | 用途 | 优先级 |
|---|---|---|
| `SectionLabel` | 小英文标签（`WRITING`/`FORUM`/`NOW`），统一标题区 | P1 |
| `StatDisplay` | 巨数字+小标签（替换 forum 统计卡的图标式） | P1 |
| `StatusDot` | 状态点（绿/琥珀/灰）+ 文字 | P1 |
| `ProgressRow` | 系列/批次进度条（细线+右侧百分比） | P2 |
| `MetaRow` | 列表项元信息行（日期·阅读时长·标签，三级灰阶） | P2 |

## 4. 分阶段执行计划

### 阶段 1：令牌换肤（半天，零风险，可立即回滚）
1. 改 `globals.css` `.dark` 变量 + 状态色 + `--radius:0`。
2. `layout.tsx` 加 `dark` class + 字体栈。
3. `badge.tsx` 圆角改方 + status variant。
4. `navbar.tsx` 顶栏圆角"控制器"化。
5. **验收**：起 dev server，逐页过 forum / knowledge / user / admin，确认无亮色残留、无对比度过低、无硬编码白底刺眼。

**门槛**：阶段 1 跑通且你确认观感对了，才进阶段 2。

### 阶段 2：标题区 + 状态可视化（1-2 天）
6. 建 `SectionLabel` / `StatDisplay` / `StatusDot`。
7. 改 `forum/page.tsx`：统计卡换巨数字、section-label 统一。
8. 改 `knowledge/page.tsx`：标题区套 SectionLabel。
9. 帖子/卡片列表项接 MetaRow 三级灰阶。

### 阶段 3：内容页深化（按需，2-3 天）
10. 帖子详情页：左侧圆点章节目录（长帖才有意义，可选）。
11. 知识卡详情：中英混排排版优化。
12. 用户主页：肖像+验证指标卡（仿 about 页）。
13. 卡片批次页：进度表格（仿 series 页）。

## 5. 风险与边界（必须先对齐）

1. **论坛 ≠ 个人站**：个人站单作者、强叙事、大留白；论坛多用户、高密度。**不能照搬巨型标题+大留白**——论坛列表要的是 `06_thought_list` 那种紧凑发丝线列表。迁移的是**令牌+组件状态规则+约束**，不是页面布局。
2. **可访问性**：`#f0f0f0` on `#080808` 对比度约 17:1（远超 WCAG AAA）；但 `muted-foreground 60%` on `#080808` 约 4.8:1，刚过 AA 正文线，更小字号需谨慎。
3. **管理后台**：admin 页表格密集，暗色下要确认数据可读性，可能需要比内容页略高的对比。
4. **不动的东西**：业务逻辑、数据层、API、认证全部不碰。纯前端视觉层。
5. **回滚**：阶段 1 全部集中在 token 层，`git revert` 单个 commit 即可完全恢复。

## 6. 建议的提交粒度

- commit 1：globals.css 令牌 + layout 暗色（核心换肤）
- commit 2：badge/navbar 圆角调整
- commit 3+：每个新组件 / 每个页面改造各一个 commit

---

**下一步**：等你确认方案。确认后我从阶段 1 开始，先做令牌换肤并起服务验收，跑通再继续。

