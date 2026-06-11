# 测试数据接口说明文档

> 面向全栈开发，说明测试数据的结构、解析链路、出入参定义。

---

## 一、测试数据文件

| 文件 | 格式 | 条数 | 时间跨度 | 用途 |
|------|------|------|----------|------|
| `test-data/chat_full.txt` | TXT | 319 | 01-01 ~ 03-30 | 完整流程测试 |
| `test-data/chat_full.json` | JSON | 319 | 同上 | 解析器+导入验证 |
| `test-data/chat_quick.txt` | TXT | 50 | 1周 | 快速冒烟测试 |
| `test-data/chat_quick.json` | JSON | 50 | 同上 | 快速冒烟测试 |

### JSON 数据格式（接口入参）

每条消息是一个对象，字段如下：

```typescript
interface TestDataRecord {
  sender_name: string;   // "我" | "她"（必需，只能是这两个值）
  content: string;       // 消息文本，Emoji 直接保留（如 "呜呜好感动🥺❤️"）
  time: string;          // 时间戳，格式 "YYYY-MM-DD HH:mm:ss"（如 "2024-01-15 09:30:00"）
  type: "text" | "image"; // "text"=文本消息、"image"=图片占位（content="[图片]"）
}
```

> **注意**：`[图片]` 占位符的 type 为 `"image"`，解析时被 messageCleaner 过滤，不参与 AI 学习。

---

## 二、完整数据流（4 个阶段）

```
[测试数据文件]                [阶段1]                    [阶段2]                    [阶段3]                  [阶段4]
                                                          │
chat_full.json ──→ useFileImport() ──→ parseChatFile() ──→ chatRecordRepo ──→ personaService ──→ chatStore.sendMessage()
chat_full.txt            │                    │             .bulkInsert()       .analyzeStyle()          │
                         │                    │                   │                  │                  │
                    入参: 无             入参: content      写入 chat_record   读取 chat_record    Few-shot → LLM
                    出参: FileImport-     fileType          表 (schema.sql     生成 style_summary  → AI 回复
                          Result         出参: ParseResult   L22-L30)          存入 persona 表      写入 message 表
```

---

## 三、各阶段接口定义

### 阶段 1：文件导入 `useFileImport()`

**文件位置**：`src/modules/fileImport/useFileImport.ts`

```typescript
// ===== 出参 =====
interface FileImportResult {
  fileName: string;    // 原始文件名，如 "chat_full.json"
  fileType: "txt" | "json";  // 根据扩展名判定
  content: string;     // 文件原始文本内容（UTF-8）
  sizeBytes: number;   // 文件大小（字节）
}

// ===== 调用方式 =====
const { pickAndRead, isImporting, error } = useFileImport();
const result: FileImportResult | null = await pickAndRead();
// result.content  → 传给 parseChatFile()
```

| 字段 | 类型 | 说明 | 调用方取值 |
|------|------|------|-----------|
| `fileName` | `string` | 原始文件名 | UI 显示用 |
| `fileType` | `"txt" \| "json"` | 由后缀判定 | **传给 parseChatFile 的第二个参数** |
| `content` | `string` | UTF-8 文本 | **传给 parseChatFile 的第一个参数** |
| `sizeBytes` | `number` | 字节数 | 校验用（上限 50MB） |

---

### 阶段 2：聊天记录解析 `parseChatFile()`

**文件位置**：`src/modules/chatParser/parserFactory.ts`

```typescript
// ===== 入参 =====
function parseChatFile(
  content: string,       // 文件原始文本（来自 FileImportResult.content）
  fileType: "txt" | "json",  // 格式（来自 FileImportResult.fileType）
): ParseResult           // 出参
```

```typescript
// ===== 中间类型 =====
interface RawMessage {
  senderName: string;                      // 发送者昵称（→ chat_record.sender_name）
  content: string;                         // 消息文本（→ chat_record.content）
  timestamp: Date;                         // 消息时间（→ chat_record.timestamp）
  type: "text" | "image" | "video" | "system" | "unknown";  //（→ chat_record.type）
}
```

```typescript
// ===== 出参 =====
interface ParseResult {
  sessions: ParsedSession[];  // 按 4 小时间隔切分的会话列表
  totalMessages: number;      // 清洗后的有效消息数（→ import_batch.total_messages）
  participants: string[];     // 去重后的参与者列表（→ import_batch.participant_count）
  timeSpan: { start: Date; end: Date };  // 时间范围（→ import_batch.time_span_*）
  ignoredCount: number;       // 被过滤的消息数（→ import_batch.ignored_count）
}

interface ParsedSession {
  sessionId: string;         // nanoid 生成的唯一 ID
  messages: RawMessage[];    // 该会话内的所有消息
  participants: string[];    // 该会话的参与者
  startTime: Date;
  endTime: Date;
}
```

**关键：清洗规则**（`messageCleaner.ts`）

以下消息在 `totalMessages`/`sessions` 中**不出现**，但计入 `ignoredCount`：

| 规则 | 代码位置 | 示例 |
|------|----------|------|
| `type !== "text"` | L14 | image/video/system 类型 |
| 空内容/纯空白 | L13 | 空字符串 |
| `/^\[.*\]$/` | L8 | `[图片]`、`[视频]` |

> **测试数据影响**：`chat_full.json` 中 9 条 `type="image"` 的消息会被过滤掉，`ignoredCount=9`。

---

### 阶段 3：数据持久化 `chatRecordRepo`

**文件位置**：`src/modules/database/repositories/chatRecordRepo.ts`

```typescript
// ===== 入参 =====
async function bulkInsertFromRawMessages(
  messages: RawMessage[],  // 来自 ParseResult.sessions 展平后的数组
  batchId: string,         // import_batch 的 ID（nanoid）
): Promise<number>         // 出参：写入行数

// ===== 单条入参（底层） =====
interface ChatRecordRow {
  // id          TEXT PK    — 自动生成（nanoid），不需要传
  batch_id:    string;     // 导入批次 ID
  sender_name: string;     // ← RawMessage.senderName
  content:     string;     // ← RawMessage.content
  timestamp:   string;     // ← RawMessage.timestamp.toISOString()  →  "2024-01-15T09:30:00.000Z"
  session_id:  string | null;  // ← ParsedSession.sessionId
  type:        string;     // ← RawMessage.type
}
```

**对应的 SQLite 表**（`schema.sql` L22-L30）：

```sql
CREATE TABLE chat_record (
  id          TEXT PRIMARY KEY,
  batch_id    TEXT NOT NULL,     -- FK → import_batch.id
  sender_name TEXT NOT NULL,     -- "我" 或 "她"
  content     TEXT NOT NULL,     -- 消息原文
  timestamp   TEXT NOT NULL,     -- ISO 8601
  session_id  TEXT,              -- 可为 NULL
  type        TEXT DEFAULT 'text'
);
```

**常用查询**（供阶段 4 使用）：

```typescript
// 获取指定发送者的全部消息 ← 用于 AI 风格学习
getBySender(senderName: string, limit?: number): Promise<ChatRecordRow[]>

// 随机采样 ← 用于 Few-shot Prompt 构建
getSampleBySender(senderName: string, limit?: number): Promise<ChatRecordRow[]>

// 获取去重后的全部发送者 ← 用于分身创建时的候选列表
getDistinctSenders(): Promise<string[]>

// 按批次查询 ← 用于导入后查看
getByBatchId(batchId: string): Promise<ChatRecordRow[]>
```

---

### 阶段 4：AI 风格学习 `personaService` + `chatStore`

**风格分析**（`styleAnalyzer.analyzeStyle()`）：

```typescript
// ===== 入参 =====
analyzeStyle(samples: string[]): Promise<string>
// samples: 消息文本数组，来自 getSampleBySender() 结果的 content 字段提取
// 返回: LLM 生成的风格描述文本（→ persona.style_summary）

// 实际调用链（personaService.ts L27-28）：
const rows = await getSampleBySender("她", 20);    // 从 chat_record 表随机取 20 条
const sampleTexts = rows.map((r) => r.content);    // 提取 content 字段 → string[]
const styleSummary = await analyzeStyle(sampleTexts);  // 传给 LLM 分析风格
// styleSummary → 存入 persona.style_summary
```

**发送消息**（`chatStore.sendMessage()`）：

```typescript
// ===== 入参 =====
sendMessage(text: string): Promise<void>

// 内部调用链：
// 1. inputSanitizer.sanitizeUserInput(text)   — XSS/注入过滤
// 2. getSampleBySender(persona.sourceSender, 20)  — 取"她"的 20 条样本
// 3. trimHistory(history)                     — 裁剪对话历史到上下文窗口
// 4. promptBuilder.buildMessages(persona, samples, history, userInput)
//    → 组装为 OpenAI 格式消息数组
// 5. deepseekService.chatNonStreaming(messages)
//    → 调用 DeepSeek API，返回模仿"她"风格的回复
// 6. StickerService.search(reply)             — 表情包关键词匹配
// 7. insertMessage(conversationId, "persona", reply, stickerUri)
//    → 写入 message 表
```

**最终存储的消息表**（`schema.sql` L55-L62）：

```sql
CREATE TABLE message (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,     -- FK → conversation.id
  role            TEXT CHECK(role IN ('user', 'persona')),
  text_content    TEXT NOT NULL,
  sticker_id      TEXT,              -- FK → sticker.id，可为 NULL
  created_at      TEXT DEFAULT (datetime('now'))
);
```

---

## 四、开发联调速查

### 跑通导入流程

```typescript
// 1. 读取测试数据
const jsonContent = require("../test-data/chat_full.json");
//    或读取文件字符串

// 2. 解析
import { parseChatFile } from "./modules/chatParser";
const result = parseChatFile(jsonContent, "json");
console.log(result.totalMessages);  // 310（已过滤 9 条 image）
console.log(result.participants);   // ["我", "她"]
console.log(result.ignoredCount);   // 9

// 3. 入库
import { bulkInsertFromRawMessages } from "./modules/database/repositories/chatRecordRepo";
const batchId = nanoid();
const allMessages = result.sessions.flatMap(s => s.messages);
const count = await bulkInsertFromRawMessages(allMessages, batchId);
// count === 310

// 4. 校验
import { getDistinctSenders, getCount } from "./modules/database/repositories/chatRecordRepo";
const senders = await getDistinctSenders();  // ["我", "她"]
const total = await getCount();              // 310
```

### 字段映射速查表

| 测试数据 JSON | RawMessage | chat_record 表 | 说明 |
|---------------|------------|----------------|------|
| `sender_name` | `senderName` | `sender_name` | 直接映射 |
| `content` | `content` | `content` | 直接映射 |
| `time` | `timestamp` | `timestamp` | JSON → `new Date(time)` → `toISOString()` |
| `type` | `type` | `type` | 直接映射；`"image"` 被 cleaner 过滤 |
| — | — | `batch_id` | 导入时生成 |
| — | — | `session_id` | sessionSplitter 分配 |

### 测试数据 sender_name 约定

- **只能是** `"我"` 或 `"她"`（严格两个值）
- `"她"` 的消息占比 58%（185/319），是 AI 模仿的目标
- `"我"` 的消息占比 42%（134/319），作为对话上下文
- 逻辑上不存在群聊、不存在第三方
