import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Node.js runtime required for Clerk v7 — declared alongside experimental.nodeMiddleware in next.config.ts
export const runtime = "nodejs";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/api/webhooks(.*)"]);

// Inlined from @/lib/auth to keep this file self-contained for the Node.js runtime bundler
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/hcps": ["business", "compliance"],
  "/hcps/new": ["business", "compliance"],
  "/dashboard": ["finance"],
  "/fmv": ["compliance"],
  "/fmv/upload": ["compliance"],
  "/engagements": ["business", "compliance", "finance", "legal"],
  "/engagements/new": ["business", "compliance"],
  "/engagements/queue": ["compliance", "finance"],
  "/engagements/legal-queue": ["legal", "compliance"],
};

function canAccessRoute(role: string, pathname: string): boolean {
  for (const [pattern, roles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname === pattern || pathname.startsWith(pattern + "/")) {
      return roles.includes(role);
    }
  }
  return true;
}

export default clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims } = await auth();
  const pathname = request.nextUrl.pathname;

  if (isPublicRoute(request)) return NextResponse.next();

  if (!userId) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(signInUrl);
  }

  const role = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;

  if (pathname.startsWith("/api/")) return NextResponse.next();

  if (!role) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (!canAccessRoute(role, pathname)) {
    let fallback = "/hcps";
    if (role === "finance") fallback = "/dashboard";
    else if (role === "legal") fallback = "/engagements/legal-queue";
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
