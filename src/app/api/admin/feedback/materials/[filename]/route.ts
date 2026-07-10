import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FILENAME_PATTERN =
  /^(?:[0-9a-f]{16}-)?\d+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const { filename } = await params;
    if (!FILENAME_PATTERN.test(filename)) {
      return NextResponse.json({ error: "文件名不正确" }, { status: 400 });
    }

    const materialDir = path.join(process.cwd(), "storage", "feedback-materials");
    const filePath = path.join(materialDir, filename);
    const relative = path.relative(materialDir, filePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return NextResponse.json({ error: "文件名不正确" }, { status: 400 });
    }

    const buffer = await readFile(filePath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Error downloading feedback material:", error);
    return NextResponse.json({ error: "文件不存在或无法下载" }, { status: 404 });
  }
}
