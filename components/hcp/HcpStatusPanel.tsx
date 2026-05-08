"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { setHcpStatus } from "@/actions/hcp";

type StatusValue = "active" | "inactive" | "suspended" | "do_not_engage";

const STATUS_OPTIONS: { value: StatusValue; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "do_not_engage", label: "Do Not Engage" },
];

export function HcpStatusPanel({
  hcpId,
  currentStatus,
}: {
  hcpId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedStatus, setSelectedStatus] = useState<StatusValue | "">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isDoNotEngage = selectedStatus === "do_not_engage";
  const isSameStatus = selectedStatus !== "" && selectedStatus === currentStatus;
  const reasonLength = reason.trim().length;
  const isValid = selectedStatus !== "" && reasonLength >= 10 && !isSameStatus;

  const reasonLabel = isDoNotEngage
    ? "Reason for Do-Not-Engage designation (required)"
    : "Reason *";

  function handleStatusChange(val: string | null) {
    if (val === null) return;
    setSelectedStatus(val as StatusValue);
    if (error) setError(null);
  }

  function handleReasonChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setReason(e.target.value);
    if (error) setError(null);
  }

  function handleSave() {
    if (!isValid || !selectedStatus) return;
    setError(null);
    startTransition(async () => {
      const result = await setHcpStatus({
        hcpId,
        status: selectedStatus as StatusValue,
        reason,
      });
      if (!result.success) {
        setError(
          result.error ?? "Status could not be saved. Refresh the page and try again."
        );
      } else {
        setSelectedStatus("");
        setReason("");
        router.refresh();
      }
    });
  }

  const currentStatusOption = STATUS_OPTIONS.find((o) => o.value === selectedStatus);
  // Tooltip is shown only when same status selected — use disabled prop on trigger
  const showTooltip = isSameStatus && !!selectedStatus;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[20px]">Set HCP Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Select */}
        <div>
          <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
            Status <span className="text-[hsl(0_72%_51%)]">*</span>
          </label>
          <Select
            value={selectedStatus}
            onValueChange={handleStatusChange}
            disabled={isPending}
          >
            <SelectTrigger
              className={cn(
                "h-11",
                isDoNotEngage &&
                  "border-[hsl(0_72%_51%)] focus:ring-[hsl(0_72%_51%)]"
              )}
              aria-label="Select new HCP status"
            >
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Reason Textarea */}
        <div>
          <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
            {reasonLabel}
          </label>
          <Textarea
            value={reason}
            onChange={handleReasonChange}
            placeholder="Enter reason for status change"
            disabled={isPending || !selectedStatus}
            className={cn(
              "min-h-[80px]",
              isDoNotEngage &&
                "border-[hsl(0_72%_51%)] focus-visible:ring-[hsl(0_72%_51%)]"
            )}
            aria-label="Reason for status change"
          />
          <div className="flex justify-between mt-1">
            {error ? (
              <span className="text-[12px] text-[hsl(0_72%_51%)]">{error}</span>
            ) : (
              <span className="text-[12px] text-[hsl(215_16%_47%)]">
                {reasonLength}/{10} minimum characters
              </span>
            )}
          </div>
        </div>

        {/* Set Status Button with same-status tooltip */}
        <TooltipProvider>
          {showTooltip ? (
            <Tooltip>
              {/* TooltipTrigger renders as a span here to wrap the disabled button */}
              <TooltipTrigger
                render={
                  <span className="block w-full">
                    <Button
                      onClick={handleSave}
                      disabled={true}
                      className="w-full h-11 bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] disabled:opacity-50"
                      aria-disabled="true"
                    >
                      Set Status
                    </Button>
                  </span>
                }
              />
              <TooltipContent>
                <p>HCP is already {currentStatusOption?.label ?? selectedStatus}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              onClick={handleSave}
              disabled={!isValid || isPending}
              className="w-full h-11 bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] disabled:opacity-50"
              aria-disabled={!isValid}
            >
              {isPending ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin mr-2"
                    aria-hidden="true"
                  />
                  Saving...
                </>
              ) : (
                "Set Status"
              )}
            </Button>
          )}
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
