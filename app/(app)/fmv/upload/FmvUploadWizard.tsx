"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileSpreadsheet, Loader2, Info, X, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RateCardTable } from "@/components/fmv/RateCardTable";
import { parseRateCardAction, activateRateCardAction } from "@/actions/fmv";
import type { ParsedCardResult } from "@/actions/fmv";

type UploadState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "preview"; rows: ParsedCardResult["rows"]; hasErrors: boolean; pendingCardId: string; rowCount: number }
  | { status: "activating" }
  | { status: "done" }
  | { status: "error"; message: string };

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function FmvUploadWizard() {
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isParsing, startParseTransition] = useTransition();
  const [isActivating, startActivateTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFileError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError("File exceeds the 5 MB limit. Split the file and re-upload.");
      setSelectedFile(null);
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
  }

  function handleRemoveFile() {
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleUploadAndParse() {
    if (!selectedFile) return;

    startParseTransition(async () => {
      setUploadState({ status: "parsing" });

      const formData = new FormData();
      formData.append("file", selectedFile);

      const result = await parseRateCardAction(formData);

      if ("error" in result) {
        setUploadState({ status: "error", message: result.error });
        return;
      }

      setUploadState({
        status: "preview",
        rows: result.rows,
        hasErrors: result.hasErrors,
        pendingCardId: result.pendingCardId,
        rowCount: result.rowCount,
      });
    });
  }

  function handleReupload() {
    setUploadState({ status: "idle" });
    setSelectedFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleActivate() {
    if (uploadState.status !== "preview") return;

    const { pendingCardId } = uploadState;

    startActivateTransition(async () => {
      setUploadState((prev) => ({ ...prev, status: "activating" } as UploadState));

      const result = await activateRateCardAction(pendingCardId);

      if (!result.success) {
        setUploadState({
          status: "error",
          message: result.error ?? "Activation failed. Try again.",
        });
        return;
      }

      toast.success("Rate card activated. Prior version superseded.");
      router.push("/fmv");
    });
  }

  const isParsingOrActivating =
    isParsing || isActivating || uploadState.status === "parsing" || uploadState.status === "activating";

  // ── Step 1: idle / error (show file drop zone) ──────────────────────────
  if (uploadState.status === "idle" || uploadState.status === "error") {
    return (
      <div className="max-w-2xl">
        {uploadState.status === "error" && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-[hsl(0_72%_83%)] bg-[hsl(0_72%_97%)] px-4 py-3">
            <AlertCircle className="h-4 w-4 text-[hsl(0_72%_51%)] mt-0.5 shrink-0" />
            <p className="text-[14px] text-[hsl(0_72%_40%)]">{uploadState.message}</p>
          </div>
        )}

        {/* Drop zone */}
        <div
          className="relative mb-4 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:border-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_96%)] transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Click to select file"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Upload rate card file"
          />

          {selectedFile ? (
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-[hsl(221_83%_53%)]" />
                <span className="text-[14px] font-medium text-[hsl(220_13%_18%)]">
                  {selectedFile.name}
                </span>
                <span className="text-[13px] text-[hsl(215_16%_47%)]">
                  ({(selectedFile.size / 1024).toFixed(0)} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                className="text-[hsl(215_16%_47%)] hover:text-[hsl(0_72%_51%)] transition-colors"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <FileSpreadsheet className="h-8 w-8 text-slate-400" />
              <p className="text-[14px] font-medium text-[hsl(220_13%_18%)]">
                Click to select a file
              </p>
              <p className="text-[13px] text-[hsl(215_16%_47%)]">
                .xlsx, .xls, or .csv — max 5 MB
              </p>
            </div>
          )}
        </div>

        {fileError && (
          <p className="mb-4 text-[14px] text-[hsl(0_72%_51%)]">{fileError}</p>
        )}

        {/* Column format hint */}
        <Card className="mb-6 border border-[hsl(220_13%_91%)] bg-[hsl(221_83%_98%)]">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-2">
              <Info className="h-4 w-4 text-[hsl(221_83%_53%)] mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-[hsl(221_83%_40%)] mb-1">
                  Required column format
                </p>
                <pre className="text-[12px] font-mono text-[hsl(220_13%_18%)] bg-white border border-[hsl(220_13%_91%)] rounded px-3 py-2">
                  {`specialty_code | state | engagement_type | rate_usd | rate_unit`}
                </pre>
                <p className="text-[12px] text-[hsl(215_16%_47%)] mt-1">
                  Valid engagement_type values: advisory_board, speaker_program,
                  investigator_research, meal_tov, training
                </p>
                <p className="text-[12px] text-[hsl(215_16%_47%)]">
                  Valid rate_unit values: per_hour, per_day, per_event, flat_fee
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            onClick={handleUploadAndParse}
            disabled={!selectedFile || isParsingOrActivating}
            className="bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11"
          >
            {isParsingOrActivating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Parsing...
              </>
            ) : (
              "Upload and Parse"
            )}
          </Button>
          <Link
            href="/fmv"
            className="inline-flex items-center justify-center rounded-lg h-11 px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            Cancel
          </Link>
        </div>
      </div>
    );
  }

  // ── Parsing in progress ──────────────────────────────────────────────────
  if (uploadState.status === "parsing") {
    return (
      <div className="max-w-2xl flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(221_83%_53%)]" />
        <p className="text-[14px] text-[hsl(215_16%_47%)]">Parsing file and validating NUCC codes...</p>
      </div>
    );
  }

  // ── Step 2: preview ──────────────────────────────────────────────────────
  if (uploadState.status === "preview" || uploadState.status === "activating") {
    const displayRows = uploadState.status === "preview" ? uploadState.rows : [];
    const displayHasErrors = uploadState.status === "preview" ? uploadState.hasErrors : false;
    const displayRowCount = uploadState.status === "preview" ? uploadState.rowCount : 0;

    const validCount = displayRows.filter((r) => r.nuccValid).length;
    const invalidCount = displayRows.length - validCount;

    return (
      <div>
        {/* Summary bar */}
        <div className="flex items-center gap-6 mb-4 px-4 py-3 rounded-lg bg-[hsl(220_14%_96%)] border border-[hsl(220_13%_91%)]">
          <div className="text-[14px]">
            <span className="font-semibold text-[hsl(220_13%_18%)]">{displayRowCount}</span>
            <span className="text-[hsl(215_16%_47%)] ml-1">total rows</span>
          </div>
          <div className="text-[14px]">
            <span className="font-semibold text-[hsl(142_71%_35%)]">{validCount}</span>
            <span className="text-[hsl(215_16%_47%)] ml-1">valid</span>
          </div>
          {invalidCount > 0 && (
            <div className="text-[14px]">
              <span className="font-semibold text-[hsl(0_72%_51%)]">{invalidCount}</span>
              <span className="text-[hsl(215_16%_47%)] ml-1">unrecognized</span>
            </div>
          )}
        </div>

        {/* Inline alert */}
        {displayHasErrors ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-[hsl(38_92%_70%)] bg-[hsl(38_92%_96%)] px-4 py-3">
            <AlertCircle className="h-4 w-4 text-[hsl(38_92%_40%)] mt-0.5 shrink-0" />
            <p className="text-[14px] text-[hsl(38_92%_30%)]">
              Some rows contain unrecognized NUCC specialty codes. Fix the file and re-upload to activate.
            </p>
          </div>
        ) : (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-[hsl(142_71%_70%)] bg-[hsl(142_71%_96%)] px-4 py-3">
            <CheckCircle className="h-4 w-4 text-[hsl(142_71%_35%)] mt-0.5 shrink-0" />
            <p className="text-[14px] text-[hsl(142_71%_25%)]">
              All specialty codes validated successfully. Ready to activate.
            </p>
          </div>
        )}

        {/* Preview table */}
        <div className="mb-6">
          <RateCardTable rows={displayRows} />
        </div>

        {/* Actions */}
        <div className="flex gap-3 items-center">
          <div className="relative group">
            <Button
              onClick={handleActivate}
              disabled={displayHasErrors || uploadState.status === "activating"}
              className="bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11 disabled:opacity-50"
              aria-disabled={displayHasErrors}
            >
              {uploadState.status === "activating" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Activating...
                </>
              ) : (
                "Activate Rate Card"
              )}
            </Button>
            {displayHasErrors && (
              <div className="absolute bottom-full mb-2 left-0 px-2 py-1 rounded bg-[hsl(220_13%_18%)] text-white text-[12px] whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                Fix unrecognized rows before activating
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={handleReupload}
            disabled={uploadState.status === "activating"}
            className="h-11"
          >
            Re-upload File
          </Button>
          <Link
            href="/fmv"
            className="inline-flex items-center justify-center rounded-lg h-11 px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            Cancel
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
