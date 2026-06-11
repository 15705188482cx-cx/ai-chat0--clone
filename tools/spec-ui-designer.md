# 全栈开发 → UI 设计师 接口规范

> 本文件供「AI聊天分身-UI设计师」智能体读取，确保输出可直接被全栈开发集成。

---

## 一、你改完代码后我应该看到什么

| 检查项 | 标准 |
|--------|------|
| TypeScript 编译 | `npx tsc --noEmit` 零错误 |
| ESLint | `npm run lint` 零错误零警告 |
| 现有测试 | `npm test` 全部 48 个用例仍然通过 |
| 页面文件 | 只修改以下 5 个文件，不新建文件 |
| 组件文件 | 如需要新组件，放在 `src/components/` 下 |

## 二、需要修改的 5 个文件

### 文件 1：`src/app/chat/[id].tsx` — 聊天界面（最高优先级）

**当前状态**：手写 FlatList + 基础微信绿色气泡，可用但不够精致。

**要求改造**：
- [ ] 深灰色导航栏 (#2E2E2E)，左侧 `<` 返回按钮，中间显示 `persona.name`，右侧 `...` 菜单
- [ ] 消息气泡：自己发的微信绿 (#95EC69)，对方白色带 #E0E0E0 边框
- [ ] 气泡圆角：自己发的（左上大圆角 12px/右下小 4px），对方（右上大圆角 12px/左下小 4px）
- [ ] 方形圆角头像 36x36 borderRadius 4，对方消息左侧显示头像，自己消息不显示
- [ ] 时间戳：居中灰色 (#B0B0B0) 12px，消息间隔 > 5 分钟时显示
- [ ] 输入栏：🎤 按钮 | 圆角输入框(白色/borderRadius 6) | 😊 按钮 | 有文字时显示绿色"发送"，无文字时显示 + 按钮
- [ ] AI 回复时：左侧头像 + "正在输入..." 灰色气泡 + 动画点
- [ ] 键盘弹起时消息列表自动上移（KeyboardAvoidingView）
- [ ] 消息列表 FlatList 设置 inverted={false}（最新消息在底部）

**接口约束（不可删除或改名）**：
```typescript
// 必须继续使用的 store 和导入
import { useChatStore, type UIMessage } from "../../stores/chatStore";
// chatStore 提供的接口：
//   messages: UIMessage[]
//   isThinking: boolean
//   persona: Persona | null
//   conversationId: string | null
//   sendMessage: (text: string) => Promise<void>
//   loadMessages: () => Promise<void>

import { useLocalSearchParams } from "expo-router";
// 路由参数：{ id: string } — 会话 ID
```

### 文件 2：`src/app/(tabs)/chats.tsx` — 会话列表

**当前状态**：FlatList + 头像 + 标题 + 时间，缺少微信细节。

**要求改造**：
- [ ] 列表项：左侧 48x48 方形圆角头像 + 中间（昵称 + 最后消息预览一行）+ 右侧时间
- [ ] 最后消息预览单行截断（numberOfLines={1}），灰色小字
- [ ] 长按弹出删除确认（Alert）
- [ ] 右上角 "+" 新建会话按钮（跳转 `/persona/setup`）
- [ ] 空状态：图标 + "还没有对话" + "开始使用" 按钮

**接口约束**：
```typescript
// 必须继续使用的 store 和 repo
import { getAllConversations, deleteConversation } from "../../modules/database/repositories/conversationRepo";
import { getPersonaById } from "../../modules/persona/personaService";
import { formatDate } from "../../utils/dateFormat";
```

### 文件 3：`src/app/(tabs)/settings.tsx` — 设置页

**当前状态**：仅 API Key 管理 + 数据统计 + 免责声明。

**要求新增**：
- [ ] **用户头像设置**：点击从相册选择（expo-image-picker），显示为圆形头像
- [ ] **用户昵称设置**：TextInput，默认"我"
- [ ] **个性签名设置**：TextInput，placeholder "未设置签名"
- [ ] **表情包管理**：数量显示 + "管理表情包" 按钮（点击弹出 StickerPickerModal）
- [ ] 保留现有：API Key 管理、数据统计、限流状态、免责声明

**接口约束**：
```typescript
// 可用组件
import { StickerPickerModal } from "../../components/StickerPickerModal";
// 现有模块（继续使用）
import { setApiKey, getApiKey, deleteApiKey } from "../../modules/config/apiKeyManager";
import { getRateLimiter } from "../../modules/aiEngine/rateLimiter";
import { getCount } from "../../modules/database/repositories/chatRecordRepo";
import { DISCLAIMER_TEXT } from "../../modules/aiEngine/contentFilter";
```

### 文件 4：`src/app/index.tsx` — 首页

**要求改造**：
- [ ] 纯色背景 (#EDEDED)
- [ ] 居中大标题"AI 聊天分身"，副标题"与另一个自己对话"
- [ ] 如果有数据 → "创建 AI 分身"主按钮（绿色） + "查看会话"次按钮
- [ ] 如果无数据 → "导入聊天记录"大按钮 + 步骤引导文字
- [ ] 页面底部或角落有进入设置的入口

**接口约束**：
```typescript
import { getDistinctSenders } from "../modules/database/repositories/chatRecordRepo";
// getDistinctSenders() 返回 string[]，空数组 = 无数据
```

### 文件 5：`src/app/persona/setup.tsx` — 分身配置

**要求新增**：
- [ ] **头像选择**：点击默认头像 → expo-image-picker 选择图片 → 圆形预览
- [ ] **昵称输入**：TextInput，默认填入选中的发送者名称
- [ ] **个性签名输入**：TextInput（可选），placeholder "这个人很懒，什么都没写"
- [ ] 保留现有：参与者列表、选中态、"创建分身并开始对话" 按钮

**接口约束**：
```typescript
import { createPersona, getAvailableSenders } from "../../modules/persona/personaService";
import { useChatStore } from "../../stores/chatStore";
// chatStore.initConversation(personaId) 创建会话并跳转
```

---

## 三、导入清单（所有页面都必须保留）

```typescript
import { useRouter } from "expo-router";           // 路由跳转
import { SafeAreaView } from "react-native-safe-area-context"; // 安全区
```

## 四、设计 Token（必须使用的值和变量名）

```typescript
const COLORS = {
  wechatGreen:    "#07C160",   // 主按钮、选中态
  bubbleGreen:    "#95EC69",   // 自己发的消息气泡
  navBar:         "#2E2E2E",   // 导航栏背景
  background:     "#EDEDED",   // 页面背景
  white:          "#FFFFFF",
  textDark:       "#333333",
  textGray:       "#999999",
  textLight:      "#B0B0B0",
  border:         "#E0E0E0",
  inputBg:        "#F6F6F6",
  danger:         "#E74C3C",
};

const FONT_SIZES = {
  navTitle: 17,
  body: 16,
  caption: 14,
  time: 12,
  small: 11,
};

const SIZES = {
  avatar: 36,          // 头像尺寸（聊天界面）
  avatarLarge: 48,     // 头像尺寸（列表页）
  avatarRadius: 4,     // 头像圆角
  bubbleRadius: 12,    // 气泡圆角
  inputRadius: 6,      // 输入框圆角
  msgPaddingH: 12,     // 消息列表左右 padding
  msgGap: 4,           // 气泡间距
};
```

## 五、验收标准

全栈开发收到 UI 设计师代码后，运行以下命令验收：

```bash
npm run lint    # 必须 0 错误 0 警告
npx tsc --noEmit  # 必须 0 错误
npm test        # 必须 48/48 通过
```

任何一项不通过，退回 UI 设计师修复。
