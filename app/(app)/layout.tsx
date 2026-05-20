import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles } from "@/lib/auth";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";
import { Toaster } from "sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // auth() reads the JWT directly — no API round-trip, no race condition on post-sign-in navigation
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const role = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;

  // Load UserGrant expansion (D-04b) from DB
  const userGrant = await prisma.userGrant.findUnique({
    where: { clerkUserId: userId },
  });
  const grants = userGrant?.grantedRoles ?? [];

  const effectiveRoles = getEffectiveRoles({ role, grants });

  // currentUser() is only needed for display data (name, avatar) — fetch in parallel with above
  const user = await currentUser();

  return (
    <div className="flex h-screen bg-[hsl(0_0%_98%)]">
      <Sidebar effectiveRoles={effectiveRoles} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header user={{ fullName: user?.fullName ?? "Unknown", imageUrl: user?.imageUrl ?? "" }} />
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
