import { chatNonStreaming } from "./deepseekService";

// ======= 丰富版本的风格分析（返回 5 层结构化数据）=======
const FULL_ANALYSIS_PROMPT = `你是一个专业的性格分析专家。分析以下聊天记录，提取说话者的性格特征。

用户提供的额外信息（如有）：{extraInfo}

聊天记录样本：
{chatSamples}

请以 JSON 格式输出完整的 5 层分析结果：

Layer 0 - 核心行为规则：
列出 5-8 条具体、可执行的行为规则。每条必须是"在什么情况下会怎么做"的完整表述。
示例：
- "生气了不会直接说，而是已读不回、语气从'好呀~'变成'嗯''哦'"
- "想要什么的时候用撒娇的方式表达：'你说嘛~''人家想吃那个'"

Layer 1 - 身份画像：
{昵称, 职业推断, MBTI推断, 依恋类型推断}

Layer 2 - 表达风格：
{口头禅列表, 高频词列表, 句式特征, emoji使用, 场景示例}

Layer 3 - 情感逻辑：
{情感优先级, 表达爱意触发, 退缩触发, 表达不满的方式}

Layer 4 - 关系行为：
{和伴侣互动, 压力下的表现}

Layer 5 - 边界与雷区：
{抵触的事, 底线, 回避的话题}

同时还要一个 styleSummary 字段（简洁的文本摘要，300字以内，用于旧版兼容）。

只输出 JSON，不要其他文字。`;

// 简易版风格分析（旧版用）
const STYLE_ANALYSIS_PROMPT = `请分析以下微信聊天记录，总结说话者的风格特点：
1. 句子长度偏好（短/长/中等）
2. 常用语气词（哈哈、嗯嗯、哇、呜呜等）
3. **Emoji 使用分析**：
   a) 列出她最常使用的 10 个 Emoji 及其出现频率
   b) 她在什么情绪/场合下使用这些 Emoji
4. 标点符号习惯（句号/空格/不用标点/感叹号连用）
5. 其他语言特征（叠词、撒娇方式、亲密称呼等）

聊天记录：
{chatSamples}

请用简洁的要点列出分析结果，总字数不超过 300 字。`;

const MOCK_STYLE_SUMMARY =
  `句子偏短，喜欢叠词（'嗯嗯''好好'），高频Emoji：🥺❤️😊✨。常用'呜呜'撒娇，感叹号和问号连用（'真的吗!!'），不用句号结尾。亲密称呼用'乖乖''宝贝'。`;

/**
 * 完整 5 层分析 —— 返回结构化 JSON
 */
export async function analyzeStyleFull(
  samples: string[],
  extraInfo = "",
): Promise<{ styleSummary: string; layers: Record<string, any> }> {
  const prompt = FULL_ANALYSIS_PROMPT
    .replace("{extraInfo}", extraInfo)
    .replace("{chatSamples}", samples.join("\n---\n"));

  try {
    const result = await chatNonStreaming([{ role: "user", content: prompt }]);
    if (result) {
      const cleaned = result.replace(/^\`\`\`(json)?\s*|\`\`\`$/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        styleSummary: parsed.styleSummary || parsed.style_summary || MOCK_STYLE_SUMMARY,
        layers: {
          layer0: parsed.layer0 || parsed["Layer 0"],
          layer1: parsed.layer1 || parsed["Layer 1"],
          layer2: parsed.layer2 || parsed["Layer 2"],
          layer3: parsed.layer3 || parsed["Layer 3"],
          layer4: parsed.layer4 || parsed["Layer 4"],
          layer5: parsed.layer5 || parsed["Layer 5"],
        },
      };
    }
  } catch {
    // 解析失败，降级为简易分析
  }

  // 降级
  const summary = await analyzeStyle(samples);
  return { styleSummary: summary, layers: {} };
}

/**
 * 简易版分析 —— 返回文本摘要（旧版兼容）
 */
export async function analyzeStyle(samples: string[]): Promise<string> {
  const prompt = STYLE_ANALYSIS_PROMPT.replace(
    "{chatSamples}",
    samples.join("\n---\n"),
  );

  try {
    const result = await chatNonStreaming([{ role: "user", content: prompt }]);
    if (result) return result;
  } catch {
    // API 不可用时降级为 mock
  }

  return MOCK_STYLE_SUMMARY;
}
