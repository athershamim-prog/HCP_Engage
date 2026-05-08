"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { runCheck, saveDetermination } from "@/actions/debarment";
import { useRouter } from "next/navigation";

type DetermOutcome = "cleared" | "confirmed_exclusion" | "false_positive";

interface Determination {
  outcome: DetermOutcome;
  rationale: string;
  recordedByName: string;
  createdAt: Date;
  checkId: string;
}

interface CheckData {
  id: string;
  oigHit: boolean;
  samHit: boolean;
  oigMatchJson: Record<string, unknown> | null;
  samMatchJson: Record<string, unknown> | null;
  createdAt: Date;
  determination: Determination | null;
}

const OUTCOME_CONFIG: Record<DetermOutcome, { label: string; className: string }> = {
  cleared: {
    label: "Cleared",
    className: "border-[hsl(142_71%_45%)] text-[hsl(142_71%_30%)]",
  },
  confirmed_exclusion: {
    label: "Confirmed Exclusion",
    className: "border-[hsl(0_72%_51%)] text-[hsl(0_72%_40%)]",
  },
  false_positive: {
    label: "False Positive",
    className: "border-[hsl(38_92%_50%)] text-[hsl(38_92%_35%)]",
  },
};

export function DebarmentCheckPanel({
  hcpId,
  isCompliance,
  initialCheck,
  debarmentCheckedAt,
}: {
  hcpId: string;
  isCompliance: boolean;
  initialCheck: CheckData | null;
  debarmentCheckedAt: Date | null;
}) {
  const router = useRouter();
  const [isRunning, startRunning] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [runError, setRunError] = useState<string | null>(null);
  const [showOigDetails, setShowOigDetails] = useState(false);
  const [showSamDetails, setShowSamDetails] = useState(false);
  const [showDetermForm, setShowDetermForm] = useState(false);
  const [determOutcome, setDetermOutcome] = useState<DetermOutcome | "">("");
  const [determRationale, setDetermRationale] = useState("");
  const [determError, setDetermError] = useState<string | null>(null);

  // Latest check is initialCheck (server-rendered); refresh via router after mutations
  const check = initialCheck;
  const hasHit = check ? check.oigHit || check.samHit : false;

  function handleRunCheck() {
    setRunError(null);
    startRunning(async () => {
      const result = await runCheck(hcpId);
      if (!result.success) {
        setRunError(result.error ?? "Check failed. Try again.");
      }
      // revalidatePath in Server Action triggers RSC refresh
      router.refresh();
    });
  }

  function handleSaveDetermination() {
    if (!check || !determOutcome || determRationale.trim().length < 20) return;
    setDetermError(null);
    startSaving(async () => {
      const result = await saveDetermination({
        checkId: check.id,
        hcpId,
        outcome: determOutcome as DetermOutcome,
        rationale: determRationale,
      });
      if (!result.success) {
        setDetermError(result.error ?? "Failed to save.");
      } else {
        setShowDetermForm(false);
        setDetermOutcome("");
        setDetermRationale("");
        router.refresh();
      }
    });
  }

  return (
    <div aria-live="polite">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          {debarmentCheckedAt ? (
            <p className="text-[12px] text-[hsl(215_16%_47%)]">
              Last checked{" "}
              {format(new Date(debarmentCheckedAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          ) : (
            <p className="text-[12px] text-[hsl(215_16%_47%)]">
              Debarment check has not been run for this HCP.
            </p>
          )}
        </div>
        {isCompliance && (
          <Button
            onClick={handleRunCheck}
            disabled={isRunning}
            className="bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11"
            aria-label="Run debarment check"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                Checking...
              </>
            ) : (
              "Run Debarment Check"
            )}
          </Button>
        )}
      </div>

      {runError && (
        <div className="mb-4 px-3 py-2 bg-[hsl(38_92%_96%)] rounded-md border border-[hsl(38_92%_70%)]">
          <p className="text-[14px] text-[hsl(38_92%_35%)]">
            Debarment check failed. {runError}
          </p>
        </div>
      )}

      {/* No check run yet */}
      {!check && !debarmentCheckedAt && (
        <p className="text-[14px] text-[hsl(215_16%_47%)]">
          {isCompliance
            ? "Run a check before submitting engagement requests."
            : "Debarment check has not been run. Run a check before submitting engagement requests."}
        </p>
      )}

      {/* Check results */}
      {check && (
        <div className="space-y-3">
          {/* OIG LEIE result row */}
          <div className="flex items-center justify-between py-2 border-b border-[hsl(220_13%_91%)]">
            <span className="text-[14px] font-semibold text-[hsl(220_13%_18%)]">
              OIG LEIE
            </span>
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "h-6 text-[12px] font-semibold border-transparent",
                  check.oigHit
                    ? "bg-[hsl(0_72%_51%)] text-white"
                    : "bg-[hsl(142_71%_45%)] text-white"
                )}
              >
                {check.oigHit ? "Match Found" : "No Hit"}
              </Badge>
              {check.oigHit && check.oigMatchJson && (
                <button
                  onClick={() => setShowOigDetails((v) => !v)}
                  className="text-[12px] text-[hsl(221_83%_53%)] flex items-center gap-1"
                  aria-expanded={showOigDetails}
                  aria-label="Toggle OIG match details"
                >
                  View match details
                  {showOigDetails ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
          </div>
          {showOigDetails && check.oigMatchJson && (
            <div className="ml-4 pl-4 border-l-2 border-[hsl(0_72%_51%)] text-[12px] space-y-1 text-[hsl(220_13%_18%)]">
              {Object.entries(check.oigMatchJson as Record<string, unknown>).map(
                ([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="font-semibold capitalize">
                      {k.replace(/([A-Z])/g, " $1")}:
                    </span>
                    <span>{String(v ?? "—")}</span>
                  </div>
                )
              )}
            </div>
          )}

          {/* SAM.gov result row */}
          <div className="flex items-center justify-between py-2 border-b border-[hsl(220_13%_91%)]">
            <span className="text-[14px] font-semibold text-[hsl(220_13%_18%)]">
              SAM.gov
            </span>
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "h-6 text-[12px] font-semibold border-transparent",
                  check.samHit
                    ? "bg-[hsl(0_72%_51%)] text-white"
                    : "bg-[hsl(142_71%_45%)] text-white"
                )}
              >
                {check.samHit ? "Match Found" : "No Hit"}
              </Badge>
              {check.samHit && check.samMatchJson && (
                <button
                  onClick={() => setShowSamDetails((v) => !v)}
                  className="text-[12px] text-[hsl(221_83%_53%)] flex items-center gap-1"
                  aria-expanded={showSamDetails}
                  aria-label="Toggle SAM.gov match details"
                >
                  View match details
                  {showSamDetails ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
          </div>
          {showSamDetails && check.samMatchJson && (
            <div className="ml-4 pl-4 border-l-2 border-[hsl(0_72%_51%)] text-[12px] space-y-1 text-[hsl(220_13%_18%)]">
              {Object.entries(check.samMatchJson as Record<string, unknown>).map(
                ([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="font-semibold capitalize">
                      {k.replace(/([A-Z])/g, " $1")}:
                    </span>
                    <span>{String(v ?? "—")}</span>
                  </div>
                )
              )}
            </div>
          )}

          {/* Prior determination */}
          {check.determination && !showDetermForm && (
            <div className="mt-4 p-4 bg-[hsl(0_0%_97%)] rounded-md border border-[hsl(220_13%_91%)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">
                  Determination
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-6 text-[12px]",
                    OUTCOME_CONFIG[check.determination.outcome].className
                  )}
                >
                  {OUTCOME_CONFIG[check.determination.outcome].label}
                </Badge>
              </div>
              <p className="text-[14px] text-[hsl(220_13%_18%)]">
                {check.determination.rationale}
              </p>
              <p className="mt-1 text-[12px] text-[hsl(215_16%_47%)]">
                Recorded by {check.determination.recordedByName}{" "}
                {format(new Date(check.determination.createdAt), "MMM d, yyyy")}
              </p>
              {isCompliance && (
                <button
                  className="mt-2 text-[12px] text-[hsl(221_83%_53%)] underline"
                  onClick={() => {
                    setShowDetermForm(true);
                    setDetermOutcome(check.determination!.outcome);
                    setDetermRationale(check.determination!.rationale);
                  }}
                >
                  Update Determination
                </button>
              )}
            </div>
          )}

          {/* Determination form — shown after match found or when updating */}
          {isCompliance && hasHit && (showDetermForm || !check.determination) && (
            <div className="mt-4 p-4 bg-[hsl(0_0%_97%)] rounded-md border border-[hsl(220_13%_91%)]">
              <h4 className="text-[14px] font-semibold text-[hsl(220_13%_18%)] mb-4">
                Record Determination
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
                    Outcome <span className="text-[hsl(0_72%_51%)]">*</span>
                  </label>
                  <Select
                    value={determOutcome}
                    onValueChange={(v) => setDetermOutcome(v as DetermOutcome)}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cleared">Cleared</SelectItem>
                      <SelectItem value="confirmed_exclusion">
                        Confirmed Exclusion
                      </SelectItem>
                      <SelectItem value="false_positive">False Positive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
                    Rationale <span className="text-[hsl(0_72%_51%)]">*</span>
                  </label>
                  <Textarea
                    value={determRationale}
                    onChange={(e) => {
                      setDetermRationale(e.target.value);
                      if (determError) setDetermError(null);
                    }}
                    placeholder="Describe your determination rationale (min 20 characters)"
                    className="min-h-[100px]"
                    aria-describedby={determError ? "determ-error" : undefined}
                  />
                  <div className="flex justify-between mt-1">
                    {determError ? (
                      <span
                        id="determ-error"
                        className="text-[12px] text-[hsl(0_72%_51%)]"
                      >
                        {determError}
                      </span>
                    ) : (
                      <span className="text-[12px] text-[hsl(215_16%_47%)]">
                        {determRationale.trim().length}/20 minimum characters
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleSaveDetermination}
                    disabled={
                      isSaving ||
                      !determOutcome ||
                      determRationale.trim().length < 20
                    }
                    className="bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Save Determination"
                    )}
                  </Button>
                  {showDetermForm && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowDetermForm(false);
                        setDetermOutcome("");
                        setDetermRationale("");
                        setDetermError(null);
                      }}
                      className="h-11"
                    >
                      Discard Changes
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
