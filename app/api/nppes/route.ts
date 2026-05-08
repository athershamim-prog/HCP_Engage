import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchNppesHcp } from "@/lib/nppes";

export async function GET(request: NextRequest) {
  // Require authentication
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const npi = request.nextUrl.searchParams.get("npi");
  if (!npi) {
    return NextResponse.json({ error: "npi parameter required" }, { status: 400 });
  }

  try {
    const hcp = await fetchNppesHcp(npi);
    if (!hcp) {
      return NextResponse.json({ found: false }, { status: 200 });
    }
    return NextResponse.json({ found: true, hcp }, { status: 200 });
  } catch (error) {
    console.error("NPPES lookup error:", error);
    return NextResponse.json(
      { error: "NPPES lookup failed" },
      { status: 502 }
    );
  }
}
