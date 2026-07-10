import { describe, expect, it } from "vitest";
import {
  detectImageType,
  detectMaterialContentType,
} from "@/lib/security/file-signatures";

describe("file signatures", () => {
  it("detects image bytes instead of trusting a MIME label", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    expect(detectImageType(png)).toEqual({
      extension: "png",
      contentType: "image/png",
    });
    expect(detectImageType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
  });

  it("requires material extensions to match their content", () => {
    expect(detectMaterialContentType(".pdf", Buffer.from("%PDF-1.7\n"))).toBe(
      "application/pdf"
    );
    expect(detectMaterialContentType(".pdf", Buffer.from("plain text"))).toBeNull();
    expect(detectMaterialContentType(".txt", Buffer.from("valid utf8"))).toBe(
      "text/plain; charset=utf-8"
    );
    expect(detectMaterialContentType(".txt", Buffer.from([0, 1, 2]))).toBeNull();
  });
});
