# AI 聊天分身

一款基于 DeepSeek API 的 React Native 应用，通过导入微信聊天记录创建 AI 分身。

## 快速开始（Android APK）

### 前置条件
- Node.js >= 18, pnpm
- Expo CLI: pnpm add -g eas-cli
- Android 设备或模拟器

### 构建 APK
`ash
pnpm install
pnpm expo prebuild
cd android && ./gradlew assembleRelease
`

或使用 EAS Build：
`ash
pnpm install
eas build --platform android --profile internal-apk
`

APK 生成后通过 db install 安装到设备。

## 首次使用

1. 安装 APK 后打开应用
2. 系统会自动加载内置测试数据（50 条恋人对话）
3. 自动创建 AI 分身并跳转到对话页
4. 首次进入对话页会弹出 API Key 配置窗口
5. 填写 DeepSeek API Key 后即可开始聊天

### API Key 获取
1. 访问 [DeepSeek Platform](https://platform.deepseek.com/)
2. 注册账号并创建 API Key
3. 在应用「设置」页或首启动弹窗中填入 Key

Key 通过设备加密存储（SecureStore），仅本地使用。

## 导入聊天记录

支持格式：
- **TXT** — 微信原生导出格式
- **JSON** — WeChatMsg 格式
- **HTML** — 微信电脑版导出格式
- **CSV** — 通用聊天记录格式

也支持直接「加载测试数据」——内置 50 条对话样本，无需外部文件即可体验。

## 功能概述

| 模块 | 说明 |
|------|------|
| 聊天导入 | 支持 TXT/JSON/HTML/CSV/截图 |
| AI 分身 | 从聊天记录分析风格，5 层人格模型 |
| 智能对话 | DeepSeek API，模仿分身语气回复 |
| 表情包 | 自动匹配 AI 回复的表情包 |
| 共同记忆 | 分析并存储对话中的共同回忆 |
| 纠正反馈 | 对不合适的回复进行纠正 |

## 高级功能

### OCR 截图导入
截图导入需要本地运行 OCR 服务，请确认已安装 Python：
`ash
cd ocr-server
pip install -r requirements.txt
python app.py
`
服务监听 http://localhost:28666。

## 技术栈

- React Native + Expo SDK 56
- TypeScript (strict mode)
- expo-router (文件路由)
- zustand (状态管理)
- expo-sqlite / localStorage (双端存储)
- DeepSeek API
- PaddleOCR（边车服务）

## 目录结构

`
src/
  app/           # expo-router 页面
  components/    # 通用组件
  hooks/         # React Hooks
  modules/       # 业务模块
    aiEngine/    # AI 引擎
    chatParser/  # 聊天记录解析
    database/    # 存储层 (IDataStore)
    persona/     # 分身管理
    sticker/     # 表情包
    fileImport/  # 文件导入
    ocr/         # OCR 截图
    config/      # 配置管理
  stores/        # zustand 状态
  theme/         # 主题常量
  utils/         # 工具函数
`

## 构建说明

- 版本: 0.1.0（内部测试版）
- Android 包名: com.internal.aichatclone
- 最低支持: Android 8+ (API 26)
