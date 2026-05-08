import { UserButton } from "@clerk/nextjs";

export function Header({
  user,
}: {
  user: { fullName: string; imageUrl: string };
}) {
  return (
    <header className="h-[56px] bg-white border-b border-[hsl(220_13%_91%)] flex items-center justify-between px-8 flex-shrink-0">
      <div /> {/* Page title injected by child pages via <title> or context in Phase 2+ */}
      <div className="flex items-center gap-3">
        <span className="text-[14px] text-[hsl(220_13%_18%)]">{user.fullName}</span>
        <UserButton />
      </div>
    </header>
  );
}
