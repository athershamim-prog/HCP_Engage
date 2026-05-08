"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { addHcp } from "@/actions/hcp";
import type { NppesHcp } from "@/lib/nppes";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; hcp: NppesHcp; alreadyInSystem: boolean; existingId?: string }
  | { status: "not_found"; npi: string }
  | { status: "error"; message: string };

export function NpiLookupForm() {
  const [npi, setNpi] = useState("");
  const [lookupState, setLookupState] = useState<LookupState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleNpiChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Only allow numeric input, max 10 chars
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setNpi(val);
    if (lookupState.status !== "idle") setLookupState({ status: "idle" });
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (npi.length !== 10) return;

    setLookupState({ status: "loading" });

    try {
      const res = await fetch(`/api/nppes?npi=${npi}`);
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json() as
        | { found: false }
        | { found: true; hcp: NppesHcp };

      if (!data.found) {
        setLookupState({ status: "not_found", npi });
        return;
      }

      // Check if already in system
      const checkRes = await fetch(`/api/hcps/exists?npi=${npi}`);
      const checkData = await checkRes.json() as { exists: boolean; id?: string };

      setLookupState({
        status: "found",
        hcp: data.hcp,
        alreadyInSystem: checkData.exists,
        existingId: checkData.id,
      });
    } catch {
      setLookupState({
        status: "error",
        message: "NPPES lookup failed. Check your connection and try again.",
      });
    }
  }

  function handleAdd() {
    if (lookupState.status !== "found" || lookupState.alreadyInSystem) return;
    startTransition(async () => {
      const result = await addHcp(lookupState.hcp);
      router.push(`/hcps/${result.id}`);
    });
  }

  function handleReset() {
    setNpi("");
    setLookupState({ status: "idle" });
  }

  const isSearching = lookupState.status === "loading";

  return (
    <div className="w-full max-w-[640px]">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          type="text"
          inputMode="numeric"
          maxLength={10}
          value={npi}
          onChange={handleNpiChange}
          placeholder="Enter 10-digit NPI"
          className="flex-1 h-11"
          aria-label="NPI number"
          disabled={isSearching}
        />
        <Button
          type="submit"
          disabled={npi.length !== 10 || isSearching}
          className="bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11 min-w-[120px]"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Searching...
            </>
          ) : (
            "Search NPI"
          )}
        </Button>
      </form>

      {/* Error states */}
      {lookupState.status === "not_found" && (
        <p className="mt-3 text-[14px] text-[hsl(0_72%_51%)]">
          No HCP found for NPI {lookupState.npi}. Verify the number and try again.
        </p>
      )}
      {lookupState.status === "error" && (
        <p className="mt-3 text-[14px] text-[hsl(0_72%_51%)]">{lookupState.message}</p>
      )}

      {/* Result card */}
      {lookupState.status === "found" && (
        <Card className="mt-4 border border-[hsl(220_13%_91%)]">
          <CardContent className="pt-6">
            {lookupState.alreadyInSystem && (
              <div className="mb-4 px-3 py-2 bg-[hsl(221_83%_96%)] rounded-md border border-[hsl(221_83%_83%)]">
                <p className="text-[14px] text-[hsl(221_83%_40%)]">
                  This HCP is already in your directory.
                </p>
              </div>
            )}

            <h3 className="text-[20px] font-semibold text-[hsl(220_13%_18%)]">
              {lookupState.hcp.fullName}
            </h3>
            {lookupState.hcp.credentials && (
              <p className="text-[12px] text-[hsl(215_16%_47%)] mt-0.5">
                {lookupState.hcp.credentials}
              </p>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[14px]">
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">Specialty</dt>
                <dd className="mt-0.5">{lookupState.hcp.nuccDisplayName} ({lookupState.hcp.nuccCode})</dd>
              </div>
              <div>
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">Primary State</dt>
                <dd className="mt-0.5">{lookupState.hcp.primaryState || "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[12px] font-semibold text-[hsl(215_16%_47%)]">HCO Affiliation</dt>
                <dd className="mt-0.5">
                  {lookupState.hcp.hcoAffiliation ?? (
                    <span className="text-[hsl(215_16%_47%)]">No affiliation on record</span>
                  )}
                </dd>
              </div>
            </dl>

            <div className="flex gap-3 mt-6">
              {lookupState.alreadyInSystem ? (
                <a
                  href={`/hcps/${lookupState.existingId}`}
                  className="inline-flex items-center justify-center rounded-lg bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11 px-4 text-sm font-medium text-white transition-colors"
                >
                  View Profile
                </a>
              ) : (
                <Button
                  onClick={handleAdd}
                  disabled={isPending}
                  className="bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Adding...
                    </>
                  ) : (
                    "Add to Directory"
                  )}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                className="h-11"
                disabled={isPending}
              >
                Search again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
