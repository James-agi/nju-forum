import { chatCompletion } from "@/lib/knowledge/llm-client";
import {
  QUERY_EXPANSION_TIMEOUT,
  QUERY_EXPANSION_MAX_TOKENS,
  QUERY_EXPANSION_TEMPERATURE,
  QUERY_EXPANSION_MAX_TERMS,
} from "@/lib/knowledge/config";

const SYSTEM_PROMPT = `你是 NJU 知识库的搜索词扩展器。用户给出一个关于南京大学校园生活的问题，你要输出 3-5 个搜索关键词，用于在知识卡片的标题和正文中做文本匹配。

规则：
1. 只输出同义词、全称、常见别名，不要发散联想
2. 保留问题中已有的关键实体词
3. 如果问题用了缩写或口语，补充正式说法，例如“保研”对应“推免”
4. 如果问题用了正式说法，补充口语说法
5. 不要输出停用词，例如“怎么”“如何”“什么”“可以”“需要”
6. 不要输出“南京大学”“南大”“学校”等泛指词

输出格式：纯 JSON 数组，例如 ["推免","保研","研究生","推荐免试"]。不要输出其他内容。`;

export async function expandQueryTerms(question: string): Promise<string[]> {
  let content: string;
  try {
    content = await chatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: question },
      ],
      maxTokens: QUERY_EXPANSION_MAX_TOKENS,
      temperature: QUERY_EXPANSION_TEMPERATURE,
      timeoutMs: QUERY_EXPANSION_TIMEOUT,
    });
  } catch {
    return [];
  }

  const trimmed = content.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start < 0 || end <= start) return [];

  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string" && item.trim().length >= 2)
      .slice(0, QUERY_EXPANSION_MAX_TERMS);
  } catch {
    return [];
  }
}
