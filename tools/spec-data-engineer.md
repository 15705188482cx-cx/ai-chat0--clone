# 全栈开发 → 数据工程师 接口规范

> 本文件供「AI聊天分身-数据工程师」智能体读取，确保输出的测试数据格式完全兼容解析器。

---

## 一、我需要你生成并放到哪个目录

```
ai-chat-clone/
└── test-data/
    ├── chat_full.txt      ← 200~300 条 TXT 格式
    ├── chat_full.json     ← 200~300 条 JSON 格式（与 TXT 内容一致）
    ├── chat_quick.txt     ← 50 条 TXT 格式
    ├── chat_quick.json    ← 50 条 JSON 格式
    └── README.md          ← 人物设定说明
```

**先创建目录**：`mkdir -p ai-chat-clone/test-data`

---

## 二、解析器兼容性检查清单

全栈开发已有解析器代码，你的数据必须通过以下规则。每条规则是一个**硬性约束**。

### TXT 格式约束

| 编号 | 规则 | 正确示例 | 错误示例 |
|------|------|---------|---------|
| TXT-1 | 每条消息以 `YYYY-MM-DD HH:mm:ss 昵称` 开头 | `2024-01-15 09:30:00 张三` | `2024/01/15 09:30 张三` |
| TXT-2 | 时间戳格式必须是 `YYYY-MM-DD HH:mm:ss`（24小时制） | `2024-01-15 14:30:00` | `2024-1-5 2:30:00` |
| TXT-3 | 时间戳和昵称之间一个空格 | `2024-01-15 09:30:00 张三` | `2024-01-15 09:30:00  张三`（多个空格不行） |
| TXT-4 | 消息内容可以多行 | 正文第一行\n正文第二行 | — |
| TXT-5 | 不同消息之间空行可选（解析器不看空行） | — | — |
| TXT-6 | 昵称可含中文、字母、数字 | `Alice_李` ✅ | — |
| TXT-7 | `[图片]` `[表情]` `[视频]` 作为文本内容出现在消息体中（不会被时间戳正则匹配为消息头） | — | 不要把 `[图片]` 写在消息头那行 |

### JSON 格式约束

| 编号 | 规则 | 正确示例 | 错误示例 |
|------|------|---------|---------|
| JSON-1 | 必须是有效的 JSON 数组 | `[{...}, {...}]` | `{"messages": [...]}` ❌ 不接受嵌套对象 |
| JSON-2 | `sender_name` 必填，string | `"sender_name": "张三"` | 缺少此字段 → 解析为 "未知" |
| JSON-3 | `content` 必填，string | `"content": "你好"` | 缺少 → 解析为 "" |
| JSON-4 | `time` 必填，格式 `YYYY-MM-DD HH:mm:ss` | `"time": "2024-01-15 09:30:00"` | `"time": "2024-01-15T09:30:00Z"` ❌ |
| JSON-5 | `type` 必填，取值 "text"\|"image"\|"video"\|"system" | `"type": "text"` | `"type": "voice"` → 被当作 "text" |
| JSON-6 | 只有 `type="text"` 的消息参与 AI 风格学习 | — | `type="image"` 被 messageCleaner 过滤 |

### 系统消息过滤规则

以下内容会被 `messageCleaner` 自动过滤，**不要**在文本消息中出现：

- `^你已添加了.*为好友`
- `^你邀请.*加入了群聊`
- `^以上是打招呼的内容`
- `^\d{4}年\d{1,2}月\d{1,2}日`
- `^\[.*\]$`（纯占位符行，如 `[图片]` `[视频]` `[文件]`）

如果你想在数据中包含系统消息（如"你已添加了xxx"），请在 JSON 中使用 `"type": "system"`，在 TXT 中作为普通消息行，它们会被正确过滤。

---

## 三、全栈开发验证脚本

你生成完 test-data/ 后，我会运行以下测试验证数据兼容性：

```bash
cd ai-chat-clone

# 1. 用 Jest 解析你的数据
npm test -- --testPathPattern="test-data"

# 2. 验证统计
node -e "
const fs = require('fs');
const { parseChatFile } = require('./src/modules/chatParser/parserFactory');

// 测试 TXT
const txt = fs.readFileSync('./test-data/chat_full.txt', 'utf-8');
const txtResult = parseChatFile(txt, 'txt');
console.log('TXT:', txtResult.totalMessages, '条消息,', txtResult.participants.length, '人,', txtResult.sessions.length, '个会话');

// 测试 JSON
const json = fs.readFileSync('./test-data/chat_full.json', 'utf-8');
const jsonResult = parseChatFile(json, 'json');
console.log('JSON:', jsonResult.totalMessages, '条消息,', jsonResult.participants.length, '人,', jsonResult.sessions.length, '个会话');
"
```

---

## 四、TXT 和 JSON 内容一致性要求

`chat_full.txt` 和 `chat_full.json` 必须包含**相同的对话内容**。我可以写脚本对比两者的消息数和参与者是否一致。

---

## 五、交付标准

| 检查项 | 标准 |
|--------|------|
| chat_full.txt | 200~300 条有效文本消息，解析后 totalMessages >= 200 |
| chat_full.json | 与 TXT 内容一致，解析后 totalMessages >= 200 |
| chat_quick.txt | 50 条有效文本消息 |
| chat_quick.json | 50 条有效文本消息 |
| 参与者 | 包含 2 个不同的发送者 |
| 会话分段 | 至少有 2 个时间间隔 > 4 小时的断点 |
| 非文本类型 | JSON 中至少包含 5 条 type="image" 的消息 |
| 系统消息 | JSON 中至少包含 1 条 type="system" 的消息 |
