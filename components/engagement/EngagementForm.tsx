"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HcpSearchInput } from "./HcpSearchInput";
import { FmvRatePanel } from "@/components/fmv/FmvRatePanel";
import {
  createEngagementAction,
  submitEngagementAction,
} from "@/actions/engagement";

const ENGAGEMENT_TYPE_OPTIONS = [
  { value: "advisory_board",        label: "Advisory Board" },
  { value: "speaker_program",       label: "Speaker Program" },
  { value: "investigator_research", label: "Investigator / Research" },
  { value: "meal_tov",              label: "Meal / TOV" },
  { value: "training",              label: "Training" },
] as const;

interface SelectedHcp {
  id: string;
  fullName: string;
  npi: string;
  nuccDisplayName: string;
  primaryState: string;
  status: string;
}

export function EngagementForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedHcp, setSelectedHcp] = useState<SelectedHcp | null>(null);
  const [engagementType, setEngagementType] = useState("");
  const [proposedDate, setProposedDate] = useState("");
  const [agreedRateUsd, setAgreedRateUsd] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [noOfActivities, setNoOfActivities] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const isPastDate = proposedDate && proposedDate < today;
  const descriptionLength = description.trim().length;

  function handleCancel() {
    if (touched) {
      if (confirm("Discard unsaved engagement?")) {
        router.push("/engagements");
      }
    } else {
      router.push("/engagements");
    }
  }

  function handleSaveDraft() {
    if (!selectedHcp) {
      setError("Select an HCP before saving.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createEngagementAction({
        hcpId: selectedHcp.id,
        engagementType,
        proposedDate,
        agreedRateUsd: parseFloat(agreedRateUsd) || 0,
        noOfActivities: parseInt(noOfActivities, 10) || null,
        description,
      });
      if (!result.success) {
        setError(result.error ?? "Could not save the engagement. Refresh the page and try again.");
      } else {
        toast.success("Draft saved.");
        router.push(`/engagements/${result.id}`);
      }
    });
  }

  function handleSubmitForApproval() {
    setError(null);
    startTransition(async () => {
      // Step 1: Create the draft
      const createResult = await createEngagementAction({
        hcpId: selectedHcp?.id ?? "",
        engagementType,
        proposedDate,
        agreedRateUsd: parseFloat(agreedRateUsd) || 0,
        noOfActivities: parseInt(noOfActivities, 10) || null,
        description,
      });
      if (!createResult.success) {
        setError(createResult.error ?? "Could not save the engagement. Refresh the page and try again.");
        return;
      }
      // Step 2: Submit it immediately
      const submitResult = await submitEngagementAction(createResult.id!);
      if (!submitResult.success) {
        setError(submitResult.error ?? "Could not submit the engagement. Refresh the page and try again.");
        return;
      }
      toast.success("Engagement submitted for approval.");
      router.push(`/engagements/${createResult.id}`);
    });
  }

  return (
    <div className="grid grid-cols-[65fr_35fr] gap-8">
      {/* Left column: form */}
      <div className="space-y-5">
        {/* HCP Search */}
        <div>
          <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
            HCP <span className="text-[hsl(0_72%_51%)]">*</span>
          </label>
          <HcpSearchInput
            selectedHcp={selectedHcp}
            onSelect={(hcp) => {
              setSelectedHcp(hcp);
              setTouched(true);
              if (error === "Select an HCP before saving.") setError(null);
            }}
            onClear={() => {
              setSelectedHcp(null);
              setTouched(true);
            }}
          />
          {error === "Select an HCP before saving." && (
            <p className="mt-1 text-[12px] text-[hsl(0_72%_51%)]">{error}</p>
          )}
        </div>

        {/* Engagement Type */}
        <div>
          <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
            Engagement Type <span className="text-[hsl(0_72%_51%)]">*</span>
          </label>
          <Select
            value={engagementType}
            onValueChange={(v) => {
              if (v) {
                setEngagementType(v);
                setTouched(true);
              }
            }}
            disabled={isPending}
          >
            <SelectTrigger className="h-11 w-full" aria-label="Select engagement type">
              <SelectValue placeholder="Select engagement type" />
            </SelectTrigger>
            <SelectContent>
              {ENGAGEMENT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Proposed Date */}
        <div>
          <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
            Proposed Date <span className="text-[hsl(0_72%_51%)]">*</span>
          </label>
          <Input
            type="date"
            value={proposedDate}
            onChange={(e) => {
              setProposedDate(e.target.value);
              setTouched(true);
            }}
            disabled={isPending}
            className="h-11"
            aria-label="Proposed date"
          />
          {isPastDate && (
            <p className="mt-1 text-[12px] text-[hsl(38_92%_50%)]">
              This date is in the past. Confirm this is correct.
            </p>
          )}
        </div>

        {/* Agreed Rate */}
        <div>
          <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
            Agreed Rate (USD) <span className="text-[hsl(0_72%_51%)]">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[hsl(215_16%_47%)]">$</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={agreedRateUsd}
              onChange={(e) => {
                setAgreedRateUsd(e.target.value);
                setTouched(true);
              }}
              disabled={isPending}
              className="h-11 pl-7"
              placeholder="0.00"
              aria-label="Agreed rate in USD"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
            Description / Scope of Work <span className="text-[hsl(0_72%_51%)]">*</span>
          </label>
          <Textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setTouched(true);
            }}
            disabled={isPending}
            rows={4}
            placeholder="Describe the engagement scope and purpose..."
            aria-label="Description or scope of work"
          />
          <div className="mt-1 text-[12px] text-[hsl(215_16%_47%)]">
            {descriptionLength}/20 minimum characters
          </div>
        </div>

        {/* Global error */}
        {error && error !== "Select an HCP before saving." && (
          <p className="text-[12px] text-[hsl(0_72%_51%)]">{error}</p>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            onClick={handleSubmitForApproval}
            disabled={isPending}
            className="h-11 bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] text-white disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                Submitting...
              </>
            ) : (
              "Submit for Approval"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isPending}
            className="h-11 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                Saving...
              </>
            ) : (
              "Save Draft"
            )}
          </Button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="inline-flex items-center justify-center h-11 px-4 text-sm font-medium text-[hsl(215_16%_47%)] hover:text-[hsl(220_13%_18%)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Right column: FMV rate reference panel + conditional noOfActivities */}
      <div className="pt-6 space-y-5">
        <FmvRatePanel
          hcpId={selectedHcp?.id ?? null}
          engagementType={engagementType || null}
        />
        <div>
          <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
            No of Activities
          </label>
          <Input
            type="number"
            min="1"
            step="1"
            value={noOfActivities}
            onChange={(e) => { setNoOfActivities(e.target.value); setTouched(true); }}
            disabled={isPending}
            className="h-11"
            placeholder="e.g., 4"
            aria-label="Number of activities"
          />
        </div>
      </div>
    </div>
  );
}
