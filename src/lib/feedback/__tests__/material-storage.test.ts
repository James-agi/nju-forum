import { beforeEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => fsMocks);

import { saveMaterialFiles } from "../material-storage";

function makeFile(name: string, content: string) {
  const bytes = new TextEncoder().encode(content);
  return {
    name,
    size: bytes.byteLength,
    type: "text/plain",
    arrayBuffer: async () => Uint8Array.from(bytes).buffer,
  } as File;
}

describe("saveMaterialFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsMocks.mkdir.mockResolvedValue(undefined);
    fsMocks.readdir.mockResolvedValue([]);
    fsMocks.stat.mockResolvedValue({ size: 0 });
    fsMocks.unlink.mockResolvedValue(undefined);
    fsMocks.writeFile.mockResolvedValue(undefined);
  });

  it("removes files already written when a later write fails", async () => {
    fsMocks.writeFile
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("disk full"));

    await expect(saveMaterialFiles([
      makeFile("first.txt", "first"),
      makeFile("second.txt", "second"),
    ], "user-1")).rejects.toThrow("disk full");

    expect(fsMocks.writeFile).toHaveBeenCalledTimes(2);
    expect(fsMocks.unlink).toHaveBeenCalledTimes(2);
    expect(String(fsMocks.unlink.mock.calls[0]?.[0])).toContain("feedback-materials");
    expect(String(fsMocks.unlink.mock.calls[0]?.[0])).toMatch(/\.txt$/);
    expect(String(fsMocks.unlink.mock.calls[1]?.[0])).toMatch(/\.txt$/);
  });

  it("validates every file before writing any of them", async () => {
    await expect(saveMaterialFiles([
      makeFile("valid.txt", "valid"),
      makeFile("invalid.exe", "invalid"),
    ], "user-1")).rejects.toThrow("只支持");

    expect(fsMocks.mkdir).not.toHaveBeenCalled();
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
    expect(fsMocks.unlink).not.toHaveBeenCalled();
  });

  it("rejects a file whose extension does not match its content", async () => {
    await expect(
      saveMaterialFiles([makeFile("not-really.pdf", "plain text")], "user-1")
    ).rejects.toThrow("扩展名与实际内容不一致");

    expect(fsMocks.writeFile).not.toHaveBeenCalled();
  });
});
