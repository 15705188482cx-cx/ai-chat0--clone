# PaddleOCR 侧边服务

## 依赖安装
```bash
cd ocr-server
pip install -r requirements.txt
```

## 启动服务
```bash
python app.py
```

服务监听 `http://localhost:28666`

## API 说明

### POST /ocr

请求：
```json
{
  "image": "base64编码的图片数据"
}
```

响应：
```json
{
  "text": "识别出的原始文字",
  "line_count": 15
}
```

## 注意事项
- 首次启动需要下载模型文件（约 50MB），耐心等待
- 建议使用 PNG 格式截图，文字清晰
- 单张图片最长边不超过 2048px
- 如需修改端口，设置环境变量 `OCR_PORT`
