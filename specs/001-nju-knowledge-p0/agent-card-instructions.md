# Agent 知识卡片起草指令 v1.2

> v1.2 变更：把网页图片候选抓取、下载和追加到 `sourceExcerpt` 的动作纳入 URL 录卡流程。

---

## 前置条件

```bash
# 工作目录
cd /d/nju-forum

# 入库方式：Prisma 直写（默认）或 API（需 cookie）
# 使用 npx.cmd（Windows 环境）
```

---

## 第0步：查库（必须先做，不可跳过）

**目的**：防止悄悄造重复卡

**执行方法**：用 Prisma 查询现有卡片

```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const existing = await prisma.knowledgeCard.findMany({
  where: {
    archivedAt: null,
    OR: [
      { summary: { contains: "关键词", mode: "insensitive" } },
      { domainTag: { contains: "关键词", mode: "insensitive" } },
    ],
  },
  select: { id: true, summary: true, domainTag: true },
});
```

**输出要求**：必须输出一句明确的现状声明

```
现状：库里已有《X》《Y》两张相关卡 ／ 库里没有相关卡
```

- 撞到同主题 → **改做补全或订正那张已有卡，不要新建**
- 确实没有 → 声明"无相关卡"，再往下走

**约束**：如果执行者不具备查库能力，必须明确告知作者，由作者在审核侧补上这一关。

---

## 第1步：抓取来源原文

| 方式 | 工具 | 适用场景 |
|---|---|---|
| 网页抓取 | Tavily extract / webfetch | 有URL的网页 |
| 语雀/动态网页抓取 | `npx.cmd tsx prisma/tools/fetch-yuque.ts <url>` | 需要渲染后提取正文和图片候选 |
| 手动粘贴 | 用户直接提供文字/图片 | 无链接来源、截图、QQ群消息 |

### 第1.5步：收集图片候选（有 URL 时一起做）

如果来源页面里有图片，抓原文时要同时列出图片候选。推荐用本地工具：

```bash
npx.cmd tsx prisma/tools/fetch-yuque.ts <url>
```

工具会输出两块内容：

```
===== 页面内容 =====
...

===== 图片候选 =====
1. 图片说明 | 1200x800 | https://...
2. ...
```

**只保留有信息量的图片候选**：表格、流程图、数据图、操作步骤截图、重要示意图。装饰图、logo、头像、背景图、分隔线不进卡。

如果作者确认某些图片要进入溯源材料，按候选索引下载：

```bash
npx.cmd tsx prisma/tools/fetch-yuque.ts <url> --download-images=1,3
```

命令会把图片保存到 `public/knowledge-images/`，并输出可直接追加到 `sourceExcerpt` 的 Markdown：

```markdown
![原文图片](/knowledge-images/xxx.png)
```

注意：图片引用只用于溯源展示，不参与检索、不喂给 LLM。如果图里的事实要被问答使用，必须把核实后的关键信息写进 `body`。

---

## 第2步：砍掉不该录的内容（两层噪声）

**第一层：语义噪声**（人读得出来）
- 旧版本信息（只录当前级，旧版直接丢）
- 过时信息
- 与本心无关的内容

**第二层：结构噪声**（自动抓取才会混进来）
- 导航栏
- 页脚（备案号、版权声明、文号、日期）
- "相关推荐/上一篇/下一篇"
- 侧边栏
- 广告

**危险**：结构噪声里最危险的是**页脚/侧栏的文号、日期、链接**。它们带着真实出处，看起来权威，一旦被当成正文里的政策依据收进卡，就造出"带着真 URL 的假溯源"。

**执行规则**：
```
删除以下内容：
1. <nav>, <footer>, <aside> 标签内的所有内容
2. 包含"备案号"、"版权所有"、"ICP"的行
3. "相关推荐"、"上一篇"、"下一篇"及其后的内容
4. 明显的导航面包屑（如"首页 > 分类 > 文章"）
5. 评论区、分享按钮、点赞区域
```

---

## 第3步：切颗粒（一卡一念）

**尺子**：一个能被单独提问的知识点 = 一张卡

**合**：同一个问题的答案，不该散在多张卡
- 例：实践课"怎么报名"和"时长怎么算"，是同一个问题的两面 → 合一张

**分**：会被分别提问的两件事，不该挤在一张卡
- 例："理论课怎么修"和"实践课怎么修"是两次独立提问 → 分两张

**容量**：body ≤ 12000字（上限）

**检验法**：一张卡的 summary 能不能用一句"怎么做 X"概括，不带"以及"？

### 切卡前：先输出卡片清单给作者确认

在动手写 body 之前，先输出一个清单：

```
来源：《XXX》
预计切出 N 张卡：
1. [summary 候选] — 预计覆盖：...
2. [summary 候选] — 预计覆盖：...
3. ...
```

作者确认后再进入第4步。

---

## 第4步：写 summary 和 body

### summary 规则
- 写成**问题的形状**，是检索的把手
- ≤200字
- 示例：`"劳动教育理论课程怎么修（2025级新生）"`

### body 规则

**三条铁律**：

1. **不编造**：来源里没有的事实（学分、时长、地址、时间），留空 + 标 `NEEDS_REVIEW`，绝不靠猜补全
2. **旧版不录**：只录当前级，旧版本信息混进来没有？
3. **年份必标**：`sourceDescription` 必须带年份/版本；`body` 结尾不加年份标注

**正文核心要求**：

> 先忠实来源，再重编排。

也就是说，body 的第一任务是把来源里已经有的真实信息排清楚，而不是先追求“写出洞察”。原文里的具体差异、限定词、条件、步骤、优缺点、对比项，都要尽量保住，不能为了简洁压成空泛判断。

**允许补充，但要克制**：
- 可以补少量经验排序、踩坑提醒、时机建议、反直觉澄清
- 这些补充必须建立在来源已给出的信息上
- 不能盖过原文，更不能把原文里的具体信息改写模糊

**检验法**：写完 body，问自己——“原文里最关键的具体信息还在不在？我有没有把很具体的话写成泛泛判断？”有一项答不上来，就重写。

### 语气规则（三条）

1. **结构可以有，但别机械**：允许用短标题、短段落、列表、加粗帮助阅读，但不要写成教学PPT式的机械标签
2. **少用祈使句**：把"务必把握""切记别拖""一定要加群"换成陈述加轻提醒
3. **平视表达，不抢原文**：正文可以更清楚，但不要为了显得“有判断”而盖过来源本身

**一句话检验法**：写完 body，读一遍问自己——**这像学长私下跟我说的话，还是像辅导员发的通知？** 如果是后者，重写。

**反面示例（不要这样）**：
```
【一句话】劳动教育理论1学分，大一第一学期会自动塞进课表。
【关键动作】务必主动加课程QQ群！考试千万别忘，忘考必挂！
【提醒】这是硬性要求，切记不要漏掉。
```

**正面示例（这样写）**：
```
劳动教育理论1学分，大一第一学期会自动塞进你的课表，本质是刷网课。
别因为不是自己主动选的，就忘了它存在。

开学后要主动做的事：课程分3个班，得加对应的课程QQ群（在哪个班看课表），
考试别忘记，忘考会挂。万一挂了也别慌，春季学期可以重修，不是一锤子买卖。
```

### 洞察自检

写完全部卡片后，对每张卡输出一句：

```
卡片 N《summary》的洞察：[一句话说明这句原文没有的话是什么]
```

作者确认后才进入第5步。

---

## 第5步：填 sourceExcerpt 和来源元数据

| 字段 | 必填 | 说明 |
|---|---|---|
| `sourceExcerpt` | 否 | 来源的**逐字片段**，可追加本地图片 Markdown，仅供用户核对溯源，**不参与问答检索、不喂给 LLM** |
| `sourceUrl` | 否 | 能跳转的原文 URL；来源是"问学长"这种没链接的就留空 |
| `sourceDescription` | 是 | 文字描述来源，**带上年份/版本**，如"南哪助手2.0（2025版）·02通识课" |
| `sourceType` | 是 | `OFFICIAL` / `DOCUMENT` / `SENIOR` / `AUTHOR_EXPERIENCE` / `OTHER` |

**sourceExcerpt 规则**：
- 必须是逐字原文，不能夹带 AI 的话
- 如果原文有有价值图片，先下载图片，再把工具输出的 `![原文图片](...)` 放在对应原文片段后面
- 如果图片没下载或 OCR/理解失败，明写"（原文含图，暂未收录图片内容）"或"（图OCR乱码未收录）"
- 不要把装饰图、logo、头像、背景图放进 `sourceExcerpt`

**同来源多卡**：多张卡来自同一篇文章时，`sourceUrl` 和 `sourceDescription` 共享，`sourceExcerpt` 各卡取各自的逐字片段。

---

## 第6步：定 verificationStatus

| 状态 | 适用场景 |
|---|---|
| `NEEDS_REVIEW` | **AI 起草的所有卡片必须用这个**，有残缺/存疑的内容 |
| `UNVERIFIED` | 内容完整但仍需作者确认（**AI 不使用此状态**） |
| `VERIFIED` | **只有作者审核后才能升到这个状态** |

**铁律**：执行者没有权力给卡盖"已核实"章，升 `VERIFIED` 是作者审核后的手动动作。

---

## 第7步：入库（Prisma 直写或 API）

### 方式一：Prisma 直写（默认）

**为什么用 Prisma**：API 有 `requireKnowledgeAuthor()` 鉴权，需要登录 session，脚本通常拿不到。

**参考模板**：`prisma/seed-knowledge.ts`（查管理员 → 按 summary 去重 → create），新脚本放 `prisma/` 下，命名如 `seed-knowledge-{来源名}.ts`。

```typescript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function createCard(card: {
  summary: string;
  body: string;
  sourceExcerpt?: string;
  sourceUrl?: string;
  sourceDescription: string;
  sourceType: "OFFICIAL" | "DOCUMENT" | "SENIOR" | "AUTHOR_EXPERIENCE" | "OTHER";
  domainTag: string;
}) {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!admin) throw new Error("找不到 ADMIN 用户");

  const created = await prisma.knowledgeCard.create({
    data: {
      summary: card.summary,
      body: card.body,
      sourceExcerpt: card.sourceExcerpt ?? null,
      sourceUrl: card.sourceUrl ?? null,
      sourceDescription: card.sourceDescription,
      sourceType: card.sourceType,
      verificationStatus: "NEEDS_REVIEW",
      domainTag: card.domainTag,
      createdById: admin.id,
    },
  });

  console.log(`卡片创建成功：${created.id}`);
  return created;
}
```

**约束**：
- `createdById` 不要抄死值，用脚本自己查管理员
- `verificationStatus` 一律 `NEEDS_REVIEW`
- 临时脚本用完即删

### 方式二：API + cookie（可选）

如果脚本有登录态（如从浏览器复制的 cookie），用 API + `draftedByAi: true` 是更优路径——Zod 校验 + `draftedByAi` 铁律都由代码自动执行。

```typescript
const cookie = "next-auth.session-token=你复制的值";

const res = await fetch("http://localhost:3000/api/knowledge/cards", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: cookie,
  },
  body: JSON.stringify({
    ...cardData,
    draftedByAi: true, // 铁律自动生效，verificationStatus 强制 NEEDS_REVIEW
  }),
});
```

**注意**：cookie 有有效期，过期需重新复制。

---

## 完整执行流程

```
输入：一个来源（URL / 文字 / 图片）

第0步  查库 → 输出"现状：库里已有X/Y ／ 无相关卡"
第1步  抓取来源原文和图片候选（webfetch / fetch-yuque / 手动粘贴）
第2步  砍掉结构噪声和语义噪声
第3步  按"一问一卡"切颗粒 → 输出卡片清单 → 作者确认
第4步  每张卡写 summary + body + 洞察自检 → 作者确认
第5步  填 sourceExcerpt（逐字原文 + 必要的图片引用）+ 来源元数据
第6步  verificationStatus = NEEDS_REVIEW
第7步  Prisma 写库（或 API + cookie）
第8步  迭代：根据作者在过程中的指导，提炼规则写入 CARD-WORKFLOW.md §5 退回案例库，反复出现的升进正文

输出：创建的卡片列表（含 id），供作者在 /admin/knowledge 审核
```

---

## 约束清单（违反即失败）

| 约束 | 说明 |
|---|---|
| 必须先查库 | 第0步不可跳过，必须输出现状声明 |
| 先看清单再动笔 | 第3步输出卡片清单，作者确认后才写 body |
| 写完全部再确认 | 第4步全部卡写完输出洞察自检，作者同意后才录入 |
| 不编造 | 来源里没有的事实，留空 + 标 NEEDS_REVIEW |
| 旧版不录 | 只录当前级，旧版直接丢 |
| 年份必标 | sourceDescription 和 body 都要带年份 |
| 至少一句洞察 | body 里必须有一句原文没有的过来人经验 |
| 语气不爹味 | 不能用"务必/切记/千万"，不能套【】标签 |
| verificationStatus = NEEDS_REVIEW | AI 起草的所有卡片必须是这个状态 |
| sourceExcerpt 是逐字原文 | 不能夹带 AI 的话 |
| 有价值图片要进入 sourceExcerpt | 表格/流程图/数据图/操作截图下载后追加 Markdown；装饰图不收 |
| 图片事实要写进 body 才能参与回答 | `sourceExcerpt` 只展示溯源，不参与检索和回答生成 |
| domainTag 用预定义值 | 尽量用已有的8个标签（新生入学、三三制、选课规则、校园服务、院系结构、保研转专业、竞赛科研、其他），新值需作者确认 |
| 不用 API 就用 Prisma | 默认 Prisma 直写；有 cookie 可走 API + draftedByAi |
| createdById 不抄死值 | 用脚本查管理员 |
| 临时脚本用完即删 | 别留在磁盘 |
| 录卡后必须迭代 | 根据作者在过程中的指导，提炼规则写入 CARD-WORKFLOW.md §5 退回案例库，反复出现的升进正文 |

---

## domainTag 预定义值

| 标签 | 适用主题 |
|---|---|
| 新生入学 | 报到、军训、寝室、迁户口、入学教育 |
| 三三制 | 三三制培养方案、长学制、贯通培养 |
| 选课规则 | 通识课、专业课、体育课、选课系统操作 |
| 校园服务 | 医院、食堂、宿舍、图书馆、网络、一卡通 |
| 院系结构 | 学院设置、专业方向、转系 |
| 保研转专业 | 保研政策、绩点计算、转专业流程 |
| 竞赛科研 | 大创、挑战杯、导师课题、论文 |
| 其他 | 不属于以上任何一类 |

---

## 常见错误示例

| 错误 | 后果 | 正确做法 |
|---|---|---|
| 没查库就新建 | 可能造重复卡 | 先输出现状声明 |
| 没给清单就动笔 | 作者无法提前纠偏 | 先输出卡片清单确认 |
| 把页脚文号当正文依据 | "带真 URL 的假溯源" | 删除所有结构噪声 |
| body 只是原文复述 | 平庸卡，没有存在理由 | 至少补一句过来人洞察 |
| 用"务必把握""切记别拖" | 爹味，用户有压迫感 | 换成陈述加轻提醒 |
| verificationStatus 填 VERIFIED | AI 没有权力盖"已核实"章 | 必须填 NEEDS_REVIEW |
| 混入旧版本信息 | 检索命中冲突卡片 | 只录当前级 |
| domainTag 随意造新值 | 标签体系碎片化 | 用预定义值，新值需确认 |
