import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getFmvRate } from "@/lib/fmv-lookup";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hcpId = request.nextUrl.searchParams.get("hcpId");
  const type = request.nextUrl.searchParams.get("type");

  if (!hcpId || !type) {
    return NextResponse.json({ error: "hcpId and type are required" }, { status: 400 });
  }

  try {
    const hcp = await prisma.hcp.findUnique({
      where: { id: hcpId },
      select: { nuccCode: true, primaryState: true },
    });
    if (!hcp) return NextResponse.json({ rate: null });

    const rate = await getFmvRate({
      nuccCode: hcp.nuccCode,
      state: hcp.primaryState,
      engagementType: type,
      prisma,
    });

    return NextResponse.json({ rate });
  } catch (error) {
    console.error("FMV rate lookup error:", error);
    return NextResponse.json({ error: "Rate lookup failed" }, { status: 500 });
  }
}
