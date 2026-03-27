import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { ATTACHMENTS_PATH } from "@/lib/db";

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const relative = segments.join("/");
  const absolute = path.resolve(ATTACHMENTS_PATH, relative);

  // Path traversal guard
  if (!absolute.startsWith(ATTACHMENTS_PATH)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const file = await readFile(absolute);
    const ext = path.extname(absolute).toLowerCase();
    const contentType = MIME_MAP[ext] ?? "application/octet-stream";
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
