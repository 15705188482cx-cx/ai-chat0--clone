# PaddleOCR 侧边服务
#
# 启动方式：
#   cd ocr-server
#   pip install -r requirements.txt
#   python app.py
#
# 服务监听 http://localhost:28666
# API: POST /ocr
# Body: { \"image\": \"base64编码的图片\" }
# Response: { \"text\": \"识别出的文字\" }

import base64
import io
import os
import time
import logging
from PIL import Image

from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 全局初始化 PaddleOCR（只加载一次）
ocr_engine = None

def get_ocr_engine():
    \"\"\"延迟初始化 PaddleOCR\"\"\"
    global ocr_engine
    if ocr_engine is None:
        logger.info(\"正在初始化 PaddleOCR（首次加载可能需要 10-30 秒）...\")
        from paddleocr import PaddleOCR
        ocr_engine = PaddleOCR(
            use_angle_cls=True,  # 文字方向分类
            lang=\"ch\",          # 中文
            show_log=False,      # 不打印详细日志
        )
        logger.info(\"PaddleOCR 初始化完成\")
    return ocr_engine

@app.route(\"/\", methods=[\"GET\"])
def health_check():
    return jsonify({\"status\": \"ok\", \"service\": \"paddle-ocr\"})

@app.route(\"/ocr\", methods=[\"POST\"])
def ocr():
    \"\"\"
    OCR 识别接口
    请求: { \"image\": \"base64编码的图片字符串\" }
    返回: { \"text\": \"识别出的原始文字\" }
    \"\"\"
    try:
        data = request.get_json()
        if not data or \"image\" not in data:
            return jsonify({\"error\": \"缺少 image 字段\"}), 400

        image_b64 = data[\"image\"]
        if not image_b64:
            return jsonify({\"error\": \"image 为空\"}), 400

        # 解码 base64
        try:
            image_bytes = base64.b64decode(image_b64)
        except Exception:
            return jsonify({\"error\": \"base64 解码失败，请检查图片数据\"}), 400

        # 转为 PIL Image
        try:
            image = Image.open(io.BytesIO(image_bytes))
        except Exception:
            return jsonify({\"error\": \"图片格式不支持，请使用 PNG/JPG\"}), 400

        # 限制图片大小（最长边不超过 2048px）
        max_dim = 2048
        w, h = image.size
        if max(w, h) > max_dim:
            scale = max_dim / max(w, h)
            image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

        # OCR 识别
        engine = get_ocr_engine()
        result = engine.ocr(image, cls=True)

        # 提取文字
        lines = []
        if result and len(result) > 0:
            # result[0] 是当前图片的识别结果
            for line_group in result[0] if result[0] else []:
                text = line_group[1][0]  # (text, confidence)
                lines.append(text)

        text = \"\\n\".join(lines)
        logger.info(f\"OCR 完成：{len(lines)} 行文字\")

        return jsonify({\"text\": text, \"line_count\": len(lines)})

    except Exception as e:
        logger.error(f\"OCR 错误: {str(e)}\")
        return jsonify({\"error\": f\"OCR 识别失败: {str(e)}\"}), 500

if __name__ == \"__main__\":
    port = int(os.environ.get(\"OCR_PORT\", 28666))
    logger.info(f\"启动 OCR 服务，端口 {port}\")
    app.run(host=\"127.0.0.1\", port=port, debug=False)
