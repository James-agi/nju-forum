import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export function getStorageNamespace(subject: string) {
  return createHash("sha256").update(subject).digest("hex").slice(0, 16);
}

export async function assertDirectoryQuota(
  directory: string,
  incomingBytes: number,
  maxStoredBytes: number,
  include: (filename: string) => boolean = () => true
) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  let storedBytes = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !include(entry.name)) continue;
    const fileStat = await stat(path.join(directory, entry.name));
    storedBytes += fileStat.size;
    if (storedBytes + incomingBytes > maxStoredBytes) {
      throw new Error("上传空间已达到上限，请先联系管理员清理历史文件");
    }
  }
}
