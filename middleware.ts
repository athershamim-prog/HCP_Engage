import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/auth";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/api/webhooks(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims } = await auth();
  const pathname = request.nextUrl.pathname;

  // Allow public routes through
  if (isPublicRoute(request)) return NextResponse.next();

  // Redirect unauthenticated users to sign-in
  if (!userId) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Get primary role from Clerk publicMetadata
  const role = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;

  // Note: UserGrant expansion (D-04b) is read in Server Components (DB access),
  // not here in middleware (no DB access at edge). Middleware enforces primary role only.
  // Server Components perform full effective-role check using getEffectiveRoles().
  const primaryRoles = role ? [role as import("@/lib/auth").AppRole] : [];

  // API routes authenticate themselves internally — skip role check here
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // Users with no role assigned would loop forever — send them back to sign-in
  if (!role) {
    const signInUrl = new URL("/sign-in", request.url);
    return NextResponse.redirect(signInUrl);
  }

  // Check route access using primary role only (conservative — expansion checked in components)
  // Finance users trying /hcps → redirect to /dashboard
  // Business users trying /dashboard → redirect to /hcps
  if (!canAccessRoute({ effectiveRoles: primaryRoles, route: pathname })) {
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
