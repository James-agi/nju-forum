import { isUtf8 } from "node:buffer";

export type DetectedImageType = {
  extension: "jpg" | "png" | "webp" | "gif" | "avif";
  contentType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "image/avif";
};

const IMAGE_TYPES: DetectedImageType[] = [
  { extension: "jpg", contentType: "image/jpeg" },
  { extension: "png", contentType: "image/png" },
  { extension: "webp", contentType: "image/webp" },
  { extension: "gif", contentType: "image/gif" },
  { extension: "avif", contentType: "image/avif" },
];

function hasBytes(buffer: Buffer, offset: number, expected: number[]) {
  if (buffer.length < offset + expected.length) return false;
  return expected.every((byte, index) => buffer[offset + index] === byte);
}

function hasAscii(buffer: Buffer, offset: number, expected: string) {
  return buffer.length >= offset + expected.length &&
    buffer.subarray(offset, offset + expected.length).toString("ascii") === expected;
}

export function detectImageType(buffer: Buffer): DetectedImageType | null {
  if (hasBytes(buffer, 0, [0xff, 0xd8, 0xff])) return IMAGE_TYPES[0];
  if (hasBytes(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return IMAGE_TYPES[1];
  }
  if (hasAscii(buffer, 0, "RIFF") && hasAscii(buffer, 8, "WEBP")) return IMAGE_TYPES[2];
  if (hasAscii(buffer, 0, "GIF87a") || hasAscii(buffer, 0, "GIF89a")) {
    return IMAGE_TYPES[3];
  }
  if (hasAscii(buffer, 4, "ftyp")) {
    const brands = buffer.subarray(8, Math.min(buffer.length, 40)).toString("ascii");
    if (brands.includes("avif") || brands.includes("avis")) return IMAGE_TYPES[4];
  }
  return null;
}

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function isZip(buffer: Buffer) {
  return (
    hasBytes(buffer, 0, [0x50, 0x4b, 0x03, 0x04]) ||
    hasBytes(buffer, 0, [0x50, 0x4b, 0x05, 0x06]) ||
    hasBytes(buffer, 0, [0x50, 0x4b, 0x07, 0x08])
  );
}

function isOpenXml(buffer: Buffer, directory: "word/" | "ppt/" | "xl/") {
  if (!isZip(buffer)) return false;
  const searchable = buffer.toString("latin1");
  return searchable.includes("[Content_Types].xml") && searchable.includes(directory);
}

function isPlainText(buffer: Buffer) {
  return isUtf8(buffer) && !buffer.includes(0);
}

export function detectMaterialContentType(extension: string, buffer: Buffer): string | null {
  switch (extension.toLowerCase()) {
    case ".pdf":
      return buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))
        ? "application/pdf"
        : null;
    case ".doc":
    case ".xls":
    case ".ppt":
      return hasBytes(buffer, 0, OLE_SIGNATURE) ? "application/x-ole-storage" : null;
    case ".docx":
      return isOpenXml(buffer, "word/")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : null;
    case ".pptx":
      return isOpenXml(buffer, "ppt/")
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : null;
    case ".xlsx":
      return isOpenXml(buffer, "xl/")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : null;
    case ".txt":
    case ".md":
    case ".csv":
      return isPlainText(buffer) ? "text/plain; charset=utf-8" : null;
    case ".jpg":
    case ".jpeg":
    case ".png":
    case ".webp": {
      const image = detectImageType(buffer);
      const expected = extension === ".jpeg" ? "jpg" : extension.slice(1);
      return image?.extension === expected ? image.contentType : null;
    }
    case ".zip":
      return isZip(buffer) ? "application/zip" : null;
    default:
      return null;
  }
}
