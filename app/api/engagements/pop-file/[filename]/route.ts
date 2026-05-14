import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { readFile } from "fs/promises";
import { resolve, sep } from "path";

const UPLOAD_DIR = resolve(process.cwd(), "uploads", "pop");

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { filename } = await params;

  // Prevent path traversal — resolve then assert prefix
  if (!filename) {
    return new NextResponse("Bad Request", { status: 400 });
  }
  const resolved = resolve(UPLOAD_DIR, filename);
  if (!resolved.startsWith(UPLOAD_DIR + sep)) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const filePath = resolved;

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
