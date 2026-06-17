# AI 聊天分身 — 设计规格文档

> 在 Figma 中新建项目时，将本文档作为设计参考。每个页面包含：设计尺寸、色板、间距、组件规格。

---

## 1. 全局设计语言

### 1.1 色板

| 角色 | HEX | 用途 |
|------|-----|------|
| 主色 WeChat Green | #07C160 | 按钮、选中态、发送、确认 |
| 辅助色 Her Pink | #FF9EAF | 她的头像背景、标签激活态 |
| 浅粉 Light Pink | #FFE4E1 | 头像边框、女性相关卡片 |
| 背景 Page BG | #F3F3F3 | 页面背景 |
| 卡片 Card White | #FFFFFF | 卡片、输入区域背景 |
| 主文字 Text Dark | #191919 | 标题、正文 |
| 二级文字 Text Gray | #666666 | 说明文字 |
| 弱提示 Text Light | #999999 | 副标题、时间戳 |
| 分割线 Border | #E5E5E5 | Hairline 分割线 |
| 错误红 Error Red | #E74C3C | 删除按钮、错误提示 |

### 1.2 字体

| 层级 | 字号 | 字重 | 颜色 | 用途 |
|------|------|------|------|------|
| 标题 H1 | 24px | Bold 700 | #191919 | 页面大标题 |
| 标题 H2 | 18px | SemiBold 600 | #191919 | 卡片标题 |
| 标题 H3 | 17px | SemiBold 600 | #333 | 导航栏标题 |
| 正文 Body | 16px | Regular 400 | #191919 | 消息文本、输入 |
| 正文小 | 15px | Regular 400 | #333 | 设置项、内容 |
| 说明 Caption | 13px | Regular 400 | #999 | 副标题、提示 |
| 小标签 Tag | 12px | Regular 400 | #666 | 标签、时间戳 |
| 极小 Mini | 11px | Regular 400 | #CCC | 版本号、辅助信息 |

### 1.3 间距系统

间距基准: 4px (4-8-12-16-20-24-32-40)
页面边距: 20px (水平)
卡片内边距: 16px
卡片圆角: 12px
列表项内边距: 14px 20px
输入框圆角: 8px
按钮圆角: 12px

### 1.4 导航栏规格

高度: 48px
背景: #FFFFFF
底部: 1px hairline #E5E5E5
标题: 居中，17px SemiBold #333
返回按钮: 左侧，36x36px，22px
右侧操作: 44x44px 点击区域

## 2. 页面规格

### 2.1 首页 (tabs)/index.tsx

设计尺寸: 390 x 844 (iPhone 14 尺寸)

布局结构:
- 顶部留白 40px
- Logo: 粉色圆形 72x72, bg#FF9EAF, 下方 12px
- 标题: "AI 聊天分身" 24px Bold, 下方 4px
- 副标题: "留住那些温柔的对话" 14px #999, 下方 24px
- 统计卡片: 圆角12, bg#FFF, mx20, 2行(消息数+分身数)
- 往下24px
- 3个操作卡片: 圆角12, bg#FFF, mx20, 间距10px
  - 导入聊天记录 (icon📂)
  - 创建AI分身 (icon✨)
  - 系统设置 (icon⚙️)
- 底部提示卡片 (首次): 圆角12, bg#FFF8F8, border #FFE4E1

### 2.2 导入聊天记录 import.tsx

3步骤流程:
- Step 1: 选择文件 (文件选择按钮 + 粘贴文本区域 + 照片导入)
- Step 2: 解析中 (进度指示器)
- Step 3: 结果显示 (参与者匹配 + 消息条数 + 确认按钮)

文件选择: 大卡片圆角12, bg#FFF, 图标📁
粘贴文本: 多行文本框 bg#FAFAFA
参与者匹配: 列表项显示发送方名称, 每个可关联/创建分身

### 2.3 创建分身 persona/setup.tsx

3步向导:
- Step 1: 选择她 — 从已导入消息的发送方列表中选择
  - 每项: 44px圆头像 + 名称 + 消息数
  - 选中态: bg#FFF0F3
- Step 2: 性格画像 — 关系信息表单
  - 在一起多久、怎么认识、分手多久、她的职业
  - 性格描述 (多行文本框)
- Step 3: 分析预览 — 显示5层分析摘要, 确认创建按钮

### 2.4 分身详情 persona/detail.tsx (新页面)

3个Tab: Persona / 记忆 / 纠正

Tab栏: 3等分, active底部2px粉色线 #FF9EAF

Persona Tab: 5张可折叠卡片, 每层一张
- Layer 0: 行为规则列表 (每行一个圆点)
- Layer 1: 信息行 (标签+值)
- Layer 2: 口头禅标签 + 高频词标签 + 场景示例卡片
- Layer 3: 信息行
- Layer 4: 信息行
- Layer 5: 列表项 (带emoji)
卡片: 圆角12, bg#FFF, mb10, shadow y1 blur4 6%

记忆 Tab: 白色卡片, 记忆条目列表
纠正 Tab: 纠正记录列表, 每条包含场景/错误行为(删除线)/正确行为/时间

### 2.5 分身编辑 persona/edit.tsx (新页面)

6个编辑区域, 上下滚动:
- Layer 0: 多行文本框, minH 100px
- Layer 1: 6个字段行 (label 80px + input flex)
- Layer 2: 4个字段 + 多行文本框
- Layer 3: 5个字段
- Layer 4: 5个字段
- Layer 5: 多行文本框, minH 100px

字段样式: bg#FAFAFA, 6px圆角, 14px
多行样式: bg#FAFAFA, 8px圆角, padding12, minH100
区域之间: 12px间距

### 2.6 聊天对话 chat/[id].tsx

类似微信的聊天界面:
- 导航栏: < 小美 (名称居中)
- 消息列表: FlatList 自动滚动
- 时间戳: 居中, 12px, #B0B0B0, my8
- 她的气泡: bg#FFFFFF, 16px圆角, 左上4px, border 1px #E4E4E4, maxW 70%
- 我的气泡: bg#DCF8C5, 16px圆角, 右上4px, maxW 70%
- 文本: 16px, lineHeight22, color#1A1A1A
- 头像: 36x36圆, 她的粉色, 我的蓝色

底部输入栏:
- 语音按钮 36x36 | 输入框 flex (bg#FFF, 5px圆角, maxH100) | 表情按钮 | 发送/+按钮
- 表情面板: maxH220, 网格6列
- 功能面板: 3个功能 (相片/拍摄/文件)

纠正弹窗:
- 遮罩: rgba(0,0,0,0.4)
- 弹窗: bg#FFF, 16px圆角, width 85%/max 400px, padding24
- 她原来的回复: bg#F5F5F5, 8px圆角, italic
- 输入框: bg#F5F5F5, 8px圆角, minH80
- 按钮: 取消(#888) + 确认(bg#07C160)

### 2.7 会话列表 (tabs)/chats.tsx

每项: 48px圆头像 + 名称 + 最后消息 + 时间
名称: 16px SemiBold
预览: 14px #999
时间: 12px #999
分割线: hairline #E5E5E5

### 2.8 分身管理 persona/manage.tsx

每个分身卡片:
- 头部: 56px圆头像 + 名称(18px) + 编辑按钮
- 操作行: 3个按钮横排 (Persona/聊天/导入)
- 签名行: label+value+arrow
- 删除按钮: 右对齐, 红色

新建卡片: 虚线边框 dashed #E5E5E5, 圆角12, 居中 +号

### 2.9 设置 (tabs)/settings.tsx

分组:
- 资料: 56x56方形头像 + 昵称 + 签名
- 分身: 每个分身一行 (40px圆头像 + 名称 + >)
- API Key: 状态 + 输入框 + 保存按钮
- 限流信息
- 关于: 免责声明 + 版本号


## 3. 设计系统组件清单 (Figma Components)

| 组件名 | 说明 | 关键参数 |
|--------|------|---------|
| NavBar | 导航栏 | H48, title居中, left/right 36x36 btn |
| BottomTab | 底部Tab栏 | 3个tab |
| ActionCard | 首页操作卡片 | 圆角12, icon+label+arrow |
| StatCard | 统计卡片 | 圆角12, 2行stat |
| LayerCard | 5层卡片(可折叠) | 圆角12, header+body, shadow |
| BubbleLeft | 对方气泡 | bg#FFF, 圆角16左上4, border |
| BubbleRight | 我的气泡 | bg#DCF8C5, 圆角16右上4 |
| InputBar | 底部输入栏 | 语音+输入+表情+发送 |
| EmojiPanel | 表情面板 | maxH220, 网格6列 |
| CorrectionModal | 纠正弹窗 | 居中modal, overlay |
| Tag | 标签 | 圆角12, bg#F0F0F0, px10 py4 |
| FormField | 编辑输入行 | label(80px)+input(flex) |
| TabBar | 详情页Tab | 3等分, 底部线2px |
| PersonaCard | 管理页分身卡片 | 圆角12, avatar+info+actions |

## 4. Figma 使用建议

1. 创建项目: 新建Figma文件, 设置390x844 iPhone14画板
2. 导入色板: 在Local Styles中创建Color Styles (第1.1节)
3. 创建文字样式: 在Local Styles中创建Text Styles (第1.2节)
4. 页面顺序: 首页 -> 设置 -> 会话列表 -> 导入 -> 创建分身 -> 分身详情 -> 分身编辑 -> 聊天对话
5. 组件命名: 使用 App/组件名 前缀, 方便后续导出到代码

建议的设计流程:
1. 从首页开始, 建立全局设计系统 (colors + typography + spacing)
2. 创建 NavBar + 底部Tab作为主框架
3. 依次设计每个页面的布局
4. 使用 Auto Layout 管理间距
5. 导出设计稿后, 对齐 React Native 代码的样式值

---
## 5. API Key 安全方案 (无需后端)

### 现状
- DeepSeek API Key 用 SecureStore (iOS Keychain / Android EncryptedSharedPreferences) 存储
- 只在调用 DeepSeek API 时从内存中读取, 用完即释放

### 安全措施
1. 存储: expo-secure-store (系统级加密存储, 非明文文件)
2. 内存: 调用时从 SecureStore 读取, 用完不缓存
3. 传输: DeepSeek API 本身走 HTTPS
4. 用户隔离: 每个用户填自己的 Key, 不存在共享

### 未来升级(如需更严格保护)
- 加编译时混淆: 用 react-native-obfuscation 混淆代码
- 加运行时检测: 检测是否在模拟器/root环境运行
- 服务端代理: 部署后端后 Key 只存服务端
