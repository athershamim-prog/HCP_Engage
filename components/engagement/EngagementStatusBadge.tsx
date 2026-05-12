import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EngagementStatusValue = "draft" | "submitted" | "approved" | "rejected" | "completed";

const STATUS_CONFIG: Record<EngagementStatusValue, { label: string; className: string }> = {
  draft:     { label: "Draft",     className: "bg-[hsl(215_16%_65%)] text-white border-transparent" },
  submitted: { label: "Submitted", className: "bg-[hsl(221_83%_53%)] text-white border-transparent" },
  approved:  { label: "Approved",  className: "bg-[hsl(142_71%_45%)] text-white border-transparent" },
  rejected:  { label: "Rejected",  className: "bg-[hsl(0_72%_51%)] text-white border-transparent" },
  completed: { label: "Completed", className: "bg-[hsl(220_13%_46%)] text-white border-transparent" },
};

export function EngagementStatusBadge({ status }: { status: EngagementStatusValue }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <Badge
      role="status"
      aria-label={`Engagement status: ${config.label}`}
      className={cn("h-6 text-[12px] font-semibold", config.className)}
    >
      {config.label}
    </Badge>
  );
}
