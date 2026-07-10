import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectMaterialContentType } from "@/lib/security/file-signatures";
import { assertDirectoryQuota, getStorageNamespace } from "@/lib/security/storage-quota";

const MAX_MATERIAL_BYTES = 10 * 1024 * 1024;
const MAX_MATERIAL_TOTAL_BYTES = 18 * 1024 * 1024;
const MAX_USER_MATERIAL_BYTES = 100 * 1024 * 1024;
const MAX_MATERIAL_FILES = 3;

const ALLOWED_MATERIAL_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".md",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".zip",
]);

export type SavedMaterialFile = {
  originalName: string;
  filename: string;
  filePath: string;
  bytes: number;
  contentType: string;
  downloadUrl: string;
};

function cleanOriginalName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 120) || "资料文件";
}

function validateMaterialFiles(files: File[]) {
  if (files.length > MAX_MATERIAL_FILES) {
    throw new Error(`一次最多上传 ${MAX_MATERIAL_FILES} 个文件`);
  }

  for (const file of files) {
    const extension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_MATERIAL_EXTENSIONS.has(extension)) {
      throw new Error("只支持 PDF、Office、文本、图片或 zip 资料文件");
    }
    if (file.size > MAX_MATERIAL_BYTES) {
      throw new Error("单个资料文件不能超过 10MB");
    }
  }
}

export async function removeMaterialFiles(files: SavedMaterialFile[]) {
  await Promise.allSettled(files.map((file) => unlink(file.filePath)));
}

export async function saveMaterialFiles(files: File[], userId: string) {
  validateMaterialFiles(files);
  if (files.length === 0) return [];

  const materialDir = path.join(process.cwd(), "storage", "feedback-materials");
  await mkdir(materialDir, { recursive: true });

  const namespace = getStorageNamespace(userId);
  const validatedFiles = [];
  let totalBytes = 0;

  for (const file of files) {
    const extension = path.extname(file.name).toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_MATERIAL_BYTES) {
      throw new Error("单个资料文件不能超过 10MB");
    }

    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_MATERIAL_TOTAL_BYTES) {
      throw new Error("单次上传文件总大小不能超过 18MB");
    }

    const contentType = detectMaterialContentType(extension, buffer);
    if (!contentType) {
      throw new Error("文件扩展名与实际内容不一致，或文件格式不受支持");
    }
    validatedFiles.push({ file, extension, buffer, contentType });
  }

  await assertDirectoryQuota(
    materialDir,
    totalBytes,
    MAX_USER_MATERIAL_BYTES,
    (filename) => filename.startsWith(`${namespace}-`)
  );

  const savedFiles: SavedMaterialFile[] = [];
  try {
    for (const { file, extension, buffer, contentType } of validatedFiles) {
      const filename = `${namespace}-${Date.now()}-${randomUUID()}${extension}`;
      const filePath = path.join(materialDir, filename);
      const savedFile = {
        originalName: cleanOriginalName(file.name),
        filename,
        filePath,
        bytes: buffer.byteLength,
        contentType,
        downloadUrl: `/api/admin/feedback/materials/${filename}`,
      };
      savedFiles.push(savedFile);
      await writeFile(filePath, buffer, { flag: "wx" });
    }
  } catch (error) {
    await removeMaterialFiles(savedFiles);
    throw error;
  }

  return savedFiles;
}
