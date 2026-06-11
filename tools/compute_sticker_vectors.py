#!/usr/bin/env python3
"""
表情包向量预计算工具（PC 端）
使用 CLIP 模型批量计算表情包图片向量，输出 vectors.json 供 App 导入。

用法：
  pip install transformers torch pillow
  python compute_sticker_vectors.py --input-dir ./stickers/ --output vectors.json
"""

import argparse
import json
import os
import sys


def main():
    parser = argparse.ArgumentParser(description="预计算表情包 CLIP 向量")
    parser.add_argument("--input-dir", required=True, help="表情包图片目录")
    parser.add_argument("--output", default="vectors.json", help="输出 JSON 文件")
    args = parser.parse_args()

    print("此脚本需要 transformers 和 torch。")
    print("如果未安装，请运行: pip install transformers torch pillow")
    print()
    print(f"输入目录: {args.input_dir}")
    print(f"输出文件: {args.output}")
    print()
    print("TODO: 在阶段 4 实现完整的 CLIP 编码逻辑")
    print("  1. 加载 clip-ViT-B-32-multilingual-v1 模型")
    print("  2. 遍历目录中所有图片")
    print("  3. 调用 model.encode_image() 生成向量")
    print("  4. 输出 [{file, vec}] 格式 JSON")


if __name__ == "__main__":
    main()
