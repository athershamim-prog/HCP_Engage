import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEffectiveRoles } from "@/lib/auth";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const role = (user.publicMetadata as { role?: string }).role;

  // Load UserGrant expansion (D-04b) from DB
  const userGrant = await prisma.userGrant.findUnique({
    where: { clerkUserId: user.id },
  });
  const grants = userGrant?.grantedRoles ?? [];

  const effectiveRoles = getEffectiveRoles({ role, grants });

  return (
    <div className="flex h-screen bg-[hsl(0_0%_98%)]">
      <Sidebar effectiveRoles={effectiveRoles} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header user={{ fullName: user.fullName ?? "Unknown", imageUrl: user.imageUrl }} />
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}
