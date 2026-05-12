import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const hcps = await prisma.hcp.findMany({
      where: {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { npi: { startsWith: q } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        npi: true,
        nuccDisplayName: true,
        primaryState: true,
        status: true,
      },
      take: 8,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return NextResponse.json({ results: hcps });
  } catch (error) {
    console.error("HCP search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
