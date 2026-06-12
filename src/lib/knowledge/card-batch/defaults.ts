import type { CardBatchPromptHook, CardBatchPhase } from "./types";

export const DEFAULT_AGENT_COMMAND_TEMPLATE =
  'opencode run --dangerously-skip-permissions "Read and execute the attached prompt file exactly." -f "{promptFile}"';

export const DEFAULT_COMPARE_PROMPT =
  "和原文细致比对，是否有出入，做到不重不漏。所覆盖的原文摘要是否覆盖原文大部分内容，剩下的是否无关紧要。发现问题后先修正卡片，再覆盖输出 cards.json、cards.md、iteration.md。iteration.md 记录本轮自审发现的问题、已修正内容、以及应该沉淀进工作流的规则。";

export const DEFAULT_CARD_BATCH_HOOKS: CardBatchPromptHook[] = [
  {
    id: "read-prompt-files",
    title: "读取规范文件",
    phase: "read_prompt_file",
    enabled: true,
    order: 10,
    content:
      "**你是批处理 agent，运行在无人值守模式下，没有用户交互。**\n\n" +
      "不要停下来提问、不要等待确认、不要寻求批准。所有决定自己做出，遇到冲突选最保守方案。\n\n" +
      "请先读取 docs/AGENT-CARD-PROMPT-SELF-CONTAINED.md、docs/CARD-WORKFLOW.md、docs/卡片工作流-使用与迭代.md。" +
      "AGENT-CARD-PROMPT-SELF-CONTAINED.md 顶部有批处理模式说明，其优先级高于文中的「等确认」指令。" +
      "只读取并理解规则，暂时不要抓取 URL，不要写卡，不要入库。读完后简要回复已理解的关键铁律。",
  },
  {
    id: "submit-url",
    title: "提交 URL",
    phase: "submit_url",
    enabled: true,
    order: 20,
    content:
      "下面是本轮要处理的 URL。请严格按照已读取的规范执行查库、抓取、去噪、切卡、写卡和导出。不要直接入库，所有卡片 verificationStatus 一律为 NEEDS_REVIEW。\n\n" +
      "URL 内容获取方式：\n" +
      "- 统一工具（推荐）：`npx tsx prisma/tools/fetch-content.ts <url>`（自动判断 PDF/语雀/普通网页）\n" +
      "- 语雀页面：`npx tsx prisma/tools/fetch-yuque.ts <url>`\n" +
      "- PDF 文件：`npx tsx prisma/tools/fetch-pdf.ts <url>`（输出文字和超链接）\n\n" +
      "sourceExcerpt 规则：放逐字原文片段和超链接。不要放 PDF 整页截图；但若 PDF 内含有价值的独立图片（图表、示意图等），应提取并嵌入。",
  },
  {
    id: "compare-source",
    title: "原文细致比对",
    phase: "compare_source",
    enabled: true,
    order: 30,
    content: DEFAULT_COMPARE_PROMPT,
  },
];

export const CARD_BATCH_PHASE_ORDER: CardBatchPhase[] = [
  "read_prompt_file",
  "submit_url",
  "compare_source",
];

export function cloneDefaultHooks() {
  return DEFAULT_CARD_BATCH_HOOKS.map((hook) => ({ ...hook }));
}
