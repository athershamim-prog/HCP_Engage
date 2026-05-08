import { formatDistanceToNow, format } from "date-fns";
import { HcpStatusBadge, HcpStatusValue } from "./HcpStatusBadge";

interface StatusHistoryEntry {
  id: string;
  status: string;
  reason: string;
  setByName: string;
  createdAt: Date;
}

export function StatusHistoryTimeline({ entries }: { entries: StatusHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-[14px] text-[hsl(215_16%_47%)]">No status changes recorded.</p>
    );
  }

  return (
    <ol className="space-y-4" aria-label="Status history">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-4">
          <div
            className="flex-shrink-0 w-2 h-2 rounded-full bg-[hsl(220_13%_18%)] mt-2"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <HcpStatusBadge status={entry.status as HcpStatusValue} />
              <time
                dateTime={new Date(entry.createdAt).toISOString()}
                className="text-[12px] text-[hsl(215_16%_47%)]"
                title={format(new Date(entry.createdAt), "PPpp")}
              >
                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
              </time>
              <span className="text-[12px] text-[hsl(215_16%_47%)]">
                by {entry.setByName}
              </span>
            </div>
            <p className="mt-1 text-[14px] text-[hsl(220_13%_18%)]">{entry.reason}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
