import { chatNonStreaming } from "./deepseekService";

// ======= 丰富版本的风格分析（返回 5 层结构化数据）=======
const FULL_ANALYSIS_PROMPT = `你是一个专业的性格分析专家。分析以下聊天记录，提取说话者的性格特征。

用户提供的额外信息（如有）：{extraInfo}

聊天记录样本：
{chatSamples}

请以 JSON 格式输出。JSON key 必须使用以下字段名：

{
  "styleSummary": "简洁文本摘要（300字以内，用于旧版兼容）",
  "layer0": ["具体的1条行为规则", "具体的2条行为规则"],
  "layer1": { "occupation": "职业推断", "mbti": "MBTI推断" },
  "layer2": { "catchphrases": ["口头禅"], "highFreqWords": ["高频词"], "styleDesc": "句式特征", "emojiDesc": "Emoji习惯" },
  "layer3": { "priority": "情感优先级", "dissatisfactionExpr": "表达不满方式" },
  "layer4": { "withPartner": "和伴侣互动", "underStress": "压力下表现" },
  "layer5": ["边界与雷区"]
}

分析以下聊天记录，提取说话者的性格特征。

Layer 0 - 核心行为规则：列出 5-8 条具体可执行的行为规则，每条必须是完整的"在什么情况下会怎么做"表述。

Layer 1 - 身份画像：昵称, 职业推断, MBTI推断

Layer 2 - 表达风格：口头禅、高频词、句式特征、emoji使用

Layer 3 - 情感逻辑：情感优先级、表达不满方式

Layer 4 - 关系行为：和伴侣互动、压力下表现

Layer 5 - 边界与雷区

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
      // 健壮提取：去掉代码块标记，再取第一个 { 到最后一个 }
      let cleaned = result.replace(/^```(?:json)?\s*|```$/g, "").trim();
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }
      const parsed = JSON.parse(cleaned);

      return {
        styleSummary: parsed.styleSummary || parsed.style_summary || MOCK_STYLE_SUMMARY,
        layers: {
          layer0: parsed.layer0 || parsed.layer_0 || null,
          layer1: parsed.layer1 || parsed.layer_1 || null,
          layer2: parsed.layer2 || parsed.layer_2 || null,
          layer3: parsed.layer3 || parsed.layer_3 || null,
          layer4: parsed.layer4 || parsed.layer_4 || null,
          layer5: parsed.layer5 || parsed.layer_5 || null,
        },
      };
    }
  } catch (err) { console.warn("[styleAnalyzer] analyzeStyleFull 失败，降级为简易分析:", err); }

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
  } catch (err) { console.warn("[styleAnalyzer] analyzeStyle API 不可用，降级为 mock:", err); }

  return MOCK_STYLE_SUMMARY;
}

