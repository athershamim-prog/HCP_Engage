"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ENGAGEMENT_TYPE_LABELS: Record<string, string> = {
  advisory_board:        "Advisory Board",
  speaker_program:       "Speaker Program",
  investigator_research: "Investigator / Research",
  meal_tov:              "Meal / TOV",
  training:              "Training",
};

const RATE_UNIT_LABELS: Record<string, string> = {
  per_hour:  "per hour",
  per_day:   "per day",
  per_event: "per event",
  flat_fee:  "flat fee",
};

interface RateData {
  nuccCode: string;
  nuccDisplayName: string;
  state: string | null;
  engagementType: string;
  rateUsd: number;
  rateUnit: string;
}

type PanelState = "initial" | "loading" | "loaded" | "no_rate" | "no_card";

interface FmvRatePanelProps {
  hcpId: string | null;
  engagementType: string | null;
  onRateLoaded?: (rateUnit: string | null) => void;
}

export function FmvRatePanel({ hcpId, engagementType, onRateLoaded }: FmvRatePanelProps) {
  const [panelState, setPanelState] = useState<PanelState>("initial");
  const [rate, setRate] = useState<RateData | null>(null);

  useEffect(() => {
    if (!hcpId || !engagementType) {
      setPanelState("initial");
      setRate(null);
      onRateLoaded?.(null);
      return;
    }

    let cancelled = false;
    setPanelState("loading");
    setRate(null);

    const fetchRate = async () => {
      try {
        const res = await fetch(
          `/api/fmv/rate?hcpId=${encodeURIComponent(hcpId)}&type=${encodeURIComponent(engagementType)}`
        );
        if (cancelled) return;

        if (!res.ok) {
          // 404 or error could mean no active card
          setPanelState("no_card");
          onRateLoaded?.(null);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        if (data.rate) {
          setRate(data.rate);
          setPanelState("loaded");
          onRateLoaded?.(data.rate.rateUnit);
        } else if (data.noActiveCard) {
          setPanelState("no_card");
          onRateLoaded?.(null);
        } else {
          setPanelState("no_rate");
          onRateLoaded?.(null);
        }
      } catch {
        if (!cancelled) {
          setPanelState("no_card");
          onRateLoaded?.(null);
        }
      }
    };

    fetchRate();
    return () => { cancelled = true; };
  }, [hcpId, engagementType]);

  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle className="text-[20px]">FMV Rate Reference</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 min-h-[80px]">
        {panelState === "initial" && (
          <p className="text-[14px] text-[hsl(215_16%_47%)]">
            Select an HCP and engagement type to see the applicable FMV rate.
          </p>
        )}

        {panelState === "loading" && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[60%]" />
          </div>
        )}

        {panelState === "loaded" && rate && (
          <div className="space-y-1">
            <p className="text-[12px] text-[hsl(215_16%_47%)]">
              {rate.nuccDisplayName} / {ENGAGEMENT_TYPE_LABELS[rate.engagementType] ?? rate.engagementType} / {rate.state ?? "National"}
            </p>
            <p className="text-[14px]">
              ${Number(rate.rateUsd).toFixed(2)} {RATE_UNIT_LABELS[rate.rateUnit] ?? rate.rateUnit}
            </p>
            <p className="text-[12px] text-[hsl(215_16%_47%)] italic">
              Shown for reference only. Submission is not blocked.
            </p>
          </div>
        )}

        {panelState === "no_rate" && (
          <div className="space-y-1">
            <p className="text-[14px] text-[hsl(215_16%_47%)]">
              No FMV rate on file for this combination.
            </p>
            <p className="text-[12px] text-[hsl(215_16%_47%)] italic">
              Submission is not blocked — document the basis for compensation in the scope field.
            </p>
          </div>
        )}

        {panelState === "no_card" && (
          <p className="text-[14px] text-[hsl(215_16%_47%)]">
            No active FMV rate card. Contact your compliance officer.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
