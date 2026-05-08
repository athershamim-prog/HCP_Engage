import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type DebarmentStatusValue = "not_checked" | "clear" | "hit";

const DEBARMENT_CONFIG: Record<DebarmentStatusValue, { label: string; className: string; showWarning: boolean }> = {
  not_checked: { label: "Not Checked", className: "bg-[hsl(215_16%_63%)] text-white border-transparent", showWarning: true },
  clear:       { label: "No Hit",      className: "bg-[hsl(142_71%_45%)] text-white border-transparent", showWarning: false },
  hit:         { label: "Match Found", className: "bg-[hsl(0_72%_51%)] text-white border-transparent",   showWarning: false },
};

export function DebarmentBadge({ status }: { status: DebarmentStatusValue }) {
  const config = DEBARMENT_CONFIG[status] ?? DEBARMENT_CONFIG.not_checked;
  return (
    <span className="flex items-center gap-1">
      {config.showWarning && (
        <AlertTriangle
          className="h-3.5 w-3.5 text-[hsl(38_92%_50%)]"
          aria-hidden="true"
        />
      )}
      <Badge
        role="status"
        aria-label={`Debarment status: ${config.label}`}
        className={cn("h-6 text-[12px] font-semibold", config.className)}
      >
        {config.label}
      </Badge>
    </span>
  );
}
