import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type HcpStatusValue = "active" | "inactive" | "suspended" | "do_not_engage";

const STATUS_CONFIG: Record<HcpStatusValue, { label: string; className: string }> = {
  active:        { label: "Active",        className: "bg-[hsl(142_71%_45%)] text-white border-transparent" },
  inactive:      { label: "Inactive",      className: "bg-[hsl(215_16%_63%)] text-white border-transparent" },
  suspended:     { label: "Suspended",     className: "bg-[hsl(38_92%_50%)] text-white border-transparent" },
  do_not_engage: { label: "Do Not Engage", className: "bg-[hsl(0_72%_51%)] text-white border-transparent" },
};

export function HcpStatusBadge({ status }: { status: HcpStatusValue }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.inactive;
  return (
    <Badge
      role="status"
      aria-label={`HCP status: ${config.label}`}
      className={cn("h-6 text-[12px] font-semibold", config.className)}
    >
      {config.label}
    </Badge>
  );
}
