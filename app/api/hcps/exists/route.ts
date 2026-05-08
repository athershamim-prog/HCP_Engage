import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const npi = request.nextUrl.searchParams.get("npi");
  if (!npi) return NextResponse.json({ error: "npi required" }, { status: 400 });

  const hcp = await prisma.hcp.findUnique({
    where: { npi },
    select: { id: true },
  });

  return NextResponse.json({ exists: !!hcp, id: hcp?.id ?? null });
}
