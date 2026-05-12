"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, UserPlus, LayoutDashboard, FileSpreadsheet, ClipboardList, Plus, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/auth";

const NAV_ITEMS = [
  {
    label: "HCP Directory",
    href: "/hcps",
    icon: Users,
    allowedRoles: ["business", "compliance"] as AppRole[],
  },
  {
    label: "Add HCP",
    href: "/hcps/new",
    icon: UserPlus,
    allowedRoles: ["business", "compliance"] as AppRole[],
  },
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    allowedRoles: ["finance"] as AppRole[],
  },
  {
    label: "FMV Rate Cards",
    href: "/fmv",
    icon: FileSpreadsheet,
    allowedRoles: ["compliance"] as AppRole[],
  },
  {
    label: "Engagements",
    href: "/engagements",
    icon: ClipboardList,
    allowedRoles: ["business", "compliance", "finance"] as AppRole[],
  },
  {
    label: "New Engagement",
    href: "/engagements/new",
    icon: Plus,
    allowedRoles: ["business", "compliance"] as AppRole[],
  },
  {
    label: "Approval Queue",
    href: "/engagements/queue",
    icon: CheckSquare,
    allowedRoles: ["compliance", "finance"] as AppRole[],
  },
];

export function Sidebar({ effectiveRoles }: { effectiveRoles: AppRole[] }) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.allowedRoles.some((r) => effectiveRoles.includes(r))
  );

  // Primary role label (first in effective roles)
  const primaryRole = effectiveRoles[0];
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] : "";

  return (
    <aside className="w-[240px] flex-shrink-0 bg-[hsl(220_13%_18%)] flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[hsl(220_13%_28%)]">
        <span className="text-[20px] font-semibold text-white">HCP Engage</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-[14px] font-normal transition-colors min-h-[44px]",
                isActive
                  ? "bg-[hsl(221_83%_53%)] text-white"
                  : "text-[hsl(220_13%_70%)] hover:bg-[hsl(220_13%_28%)] hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Role label at bottom */}
      <div className="px-6 py-4 border-t border-[hsl(220_13%_28%)]">
        <p className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">{roleLabel}</p>
      </div>
    </aside>
  );
}
