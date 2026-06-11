import { useState, useCallback } from "react";
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { stripBOM, isLikelyGBK } from "./encodingDetector";

export interface FileImportResult {
  fileName: string;
  fileType: "txt" | "json";
  content: string;
  sizeBytes: number;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

async function readFileNative(uri: string): Promise<string> {
  const FileSystem = await import("expo-file-system/legacy");
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

async function readFileWeb(uri: string): Promise<string> {
  const response = await fetch(uri);
  return response.text();
}

export function useFileImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickAndRead = useCallback(async (): Promise<FileImportResult | null> => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/plain",
          "application/json",
          "application/octet-stream",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return null;
      const file = result.assets[0];

      if (file.size && file.size > MAX_FILE_SIZE) {
        setError("文件过大，请选择 50MB 以内的文件");
        return null;
      }

      const fileName = file.name.toLowerCase();
      let fileType: "txt" | "json";
      if (fileName.endsWith(".json")) {
        fileType = "json";
      } else if (fileName.endsWith(".txt")) {
        fileType = "txt";
      } else {
        setError("不支持的文件格式，仅支持 TXT 和 JSON");
        return null;
      }

      setIsImporting(true);
      const rawContent =
        Platform.OS === "web"
          ? await readFileWeb(file.uri)
          : await readFileNative(file.uri);

      const content = stripBOM(rawContent);

      if (isLikelyGBK(content)) {
        setError("文件编码可能为 GBK，请用 UTF-8 重新导出聊天记录");
        return null;
      }

      return { fileName: file.name, fileType, content, sizeBytes: file.size ?? 0 };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "文件读取失败";
      setError(message);
      return null;
    } finally {
      setIsImporting(false);
    }
  }, []);

  return { pickAndRead, isImporting, error };
}
