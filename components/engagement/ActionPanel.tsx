"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  approveEngagementAction,
  rejectEngagementAction,
  completeEngagementAction,
  deleteEngagementAction,
  submitEngagementAction,
  sendToLegalAction,
  legalReturnAction,
  sendToFinanceAction,
  attachPopAction,
} from "@/actions/engagement";
import type { EngagementStatusValue } from "@/components/engagement/EngagementStatusBadge";

interface ActionPanelProps {
  engagementId: string;
  status: EngagementStatusValue;
  submittedByClerkId: string;
  currentUserClerkId: string;
  effectiveRoles: string[];
  rejectionReason?: string | null;
  popDocumentUrl?: string | null;
}

export function ActionPanel({
  engagementId,
  status,
  submittedByClerkId,
  currentUserClerkId,
  effectiveRoles,
  rejectionReason,
  popDocumentUrl,
}: ActionPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectionText, setRejectionText] = useState("");
  const [legalFeedback, setLegalFeedback] = useState("");
  const [popUrl, setPopUrl] = useState(popDocumentUrl ?? "");
  const [error, setError] = useState<string | null>(null);

  const isOwner = submittedByClerkId === currentUserClerkId;
  const isCompliance = effectiveRoles.includes("compliance");
  const isFinance = effectiveRoles.includes("finance");
  const isLegal = effectiveRoles.includes("legal");
  const isComplianceOrFinance = isCompliance || isFinance;
  const isBusinessOnly =
    effectiveRoles.includes("business") && !isCompliance && !isFinance;

  const rejectionCharCount = rejectionText.trim().length;
  const canReject = rejectionCharCount >= 10;
  const legalFeedbackCharCount = legalFeedback.trim().length;
  const canReturnFromLegal = legalFeedbackCharCount >= 10;

  function wrap(fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string, redirect?: string) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.success) {
        setError(result.error ?? "Action failed. Refresh the page and try again.");
      } else {
        toast.success(successMsg);
        if (redirect) {
          router.push(redirect);
        } else {
          router.refresh();
        }
      }
    });
  }

  // ── Draft (owner) ──────────────────────────────────────────────────────────
  if (status === "draft" && isOwner) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-[20px]">Actions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => wrap(() => submitEngagementAction(engagementId), "Engagement submitted for approval.")}
            disabled={isPending}
            className="w-full h-11 bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] text-white"
          >
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : "Submit for Approval"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger disabled={isPending} className="block w-full text-center text-[12px] text-[hsl(0_72%_51%)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
              Delete this draft
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete engagement draft?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone. The draft will be permanently deleted.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel variant="outline">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => wrap(() => deleteEngagementAction(engagementId), "Draft deleted.", "/engagements")} className="bg-[hsl(0_72%_51%)] text-white hover:bg-[hsl(0_72%_45%)]">
                  Delete Draft
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {error && <p className="text-[12px] text-[hsl(0_72%_51%)]">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  // ── Draft (non-owner) ──────────────────────────────────────────────────────
  if (status === "draft") {
    return <ReadOnlyCard message="Draft — waiting for submission" />;
  }

  // ── Submitted / Compliance Review — Compliance actions ─────────────────────
  if ((status === "submitted" || status === "compliance_review") && isCompliance) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-[20px]">Review Engagement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => wrap(() => approveEngagementAction(engagementId), "Engagement approved — Business will attach PoP.")}
            disabled={isPending}
            className="w-full h-11 bg-[hsl(142_71%_45%)] hover:bg-[hsl(142_71%_38%)] text-white"
          >
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Approving...</> : "Approve (Request PoP)"}
          </Button>
          <Button
            onClick={() => wrap(() => sendToLegalAction(engagementId), "Sent to Legal for review.")}
            disabled={isPending}
            variant="outline"
            className="w-full h-11"
          >
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</> : "Send to Legal"}
          </Button>
          <Button
            onClick={() => wrap(() => sendToFinanceAction(engagementId), "Sent directly to Finance.")}
            disabled={isPending}
            variant="outline"
            className="w-full h-11"
          >
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</> : "Send to Finance"}
          </Button>
          <Divider />
          <RejectForm
            value={rejectionText}
            onChange={setRejectionText}
            charCount={rejectionCharCount}
            canReject={canReject}
            isPending={isPending}
            onReject={() => wrap(() => rejectEngagementAction(engagementId, rejectionText), "Engagement rejected.")}
          />
          {error && <p className="text-[12px] text-[hsl(0_72%_51%)]">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  // ── Submitted / Compliance Review — Business waiting ───────────────────────
  if (status === "submitted" || status === "compliance_review") {
    return <ReadOnlyCard message="Pending Compliance Review" />;
  }

  // ── Legal Review — Legal actions ────────────────────────────────────────────
  if (status === "legal_review" && isLegal) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-[20px]">Legal Review</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
              Legal Feedback <span className="text-[hsl(0_72%_51%)]">*</span>
            </label>
            <Textarea
              value={legalFeedback}
              onChange={(e) => setLegalFeedback(e.target.value)}
              placeholder="Provide your legal assessment and recommendations..."
              disabled={isPending}
              className="min-h-[100px]"
            />
            <p className="text-[12px] text-[hsl(215_16%_47%)] mt-1">
              {legalFeedbackCharCount}/10 minimum characters
            </p>
          </div>
          <Button
            onClick={() => wrap(() => legalReturnAction(engagementId, legalFeedback), "Feedback submitted — returned to Compliance.")}
            disabled={isPending || !canReturnFromLegal}
            className="w-full h-11 bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] text-white disabled:opacity-50"
          >
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : "Submit Feedback & Return"}
          </Button>
          {error && <p className="text-[12px] text-[hsl(0_72%_51%)]">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  // ── Legal Review — others waiting ───────────────────────────────────────────
  if (status === "legal_review") {
    return <ReadOnlyCard message="Pending Legal Review" />;
  }

  // ── Approved — owner attaches PoP ──────────────────────────────────────────
  if (status === "approved" && isOwner) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-[20px]">Attach Proof of Performance</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[13px] text-[hsl(215_16%_47%)]">
            The engagement has been approved. Attach a document reference confirming the activity was completed.
          </p>
          <div>
            <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
              PoP Document Reference <span className="text-[hsl(0_72%_51%)]">*</span>
            </label>
            <Input
              value={popUrl}
              onChange={(e) => setPopUrl(e.target.value)}
              placeholder="e.g., SharePoint link, document ID, or file name"
              disabled={isPending}
            />
          </div>
          <Button
            onClick={() => wrap(() => attachPopAction(engagementId, popUrl), "Proof of Performance submitted.")}
            disabled={isPending || !popUrl.trim()}
            className="w-full h-11 bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] text-white disabled:opacity-50"
          >
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : "Submit PoP"}
          </Button>
          {error && <p className="text-[12px] text-[hsl(0_72%_51%)]">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  // ── Approved — non-owner waiting ───────────────────────────────────────────
  if (status === "approved") {
    return <ReadOnlyCard message="Approved — awaiting Proof of Performance from submitter" />;
  }

  // ── PoP Submitted — Compliance actions ────────────────────────────────────
  if (status === "pop_submitted" && isCompliance) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-[20px]">Review Proof of Performance</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {popDocumentUrl && (
            <p className="text-[13px] text-[hsl(220_13%_18%)] break-words">
              <span className="font-semibold">PoP Reference:</span> {popDocumentUrl}
            </p>
          )}
          <Button
            onClick={() => wrap(() => sendToFinanceAction(engagementId), "Sent to Finance for payment processing.")}
            disabled={isPending}
            className="w-full h-11 bg-[hsl(199_89%_48%)] hover:bg-[hsl(199_89%_40%)] text-white"
          >
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</> : "Send to Finance"}
          </Button>
          <Button
            onClick={() => wrap(() => sendToLegalAction(engagementId), "Sent to Legal for review.")}
            disabled={isPending}
            variant="outline"
            className="w-full h-11"
          >
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending...</> : "Send PoP to Legal"}
          </Button>
          <Divider />
          <RejectForm
            value={rejectionText}
            onChange={setRejectionText}
            charCount={rejectionCharCount}
            canReject={canReject}
            isPending={isPending}
            onReject={() => wrap(() => rejectEngagementAction(engagementId, rejectionText), "Engagement rejected.")}
          />
          {error && <p className="text-[12px] text-[hsl(0_72%_51%)]">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  // ── PoP Submitted — others waiting ─────────────────────────────────────────
  if (status === "pop_submitted") {
    return <ReadOnlyCard message="Proof of Performance submitted — pending Compliance review" />;
  }

  // ── Finance Review — Finance actions ───────────────────────────────────────
  if (status === "finance_review" && isFinance) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-[20px]">Finance Review</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => wrap(() => completeEngagementAction(engagementId), "Engagement completed.")}
            disabled={isPending}
            className="w-full h-11 bg-[hsl(142_71%_45%)] hover:bg-[hsl(142_71%_38%)] text-white"
          >
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Completing...</> : "Mark as Completed"}
          </Button>
          <Divider />
          <RejectForm
            value={rejectionText}
            onChange={setRejectionText}
            charCount={rejectionCharCount}
            canReject={canReject}
            isPending={isPending}
            onReject={() => wrap(() => rejectEngagementAction(engagementId, rejectionText), "Engagement rejected.")}
          />
          {error && <p className="text-[12px] text-[hsl(0_72%_51%)]">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  // ── Finance Review — others waiting ────────────────────────────────────────
  if (status === "finance_review") {
    return <ReadOnlyCard message="Pending Finance Review" />;
  }

  // ── Rejected ───────────────────────────────────────────────────────────────
  if (status === "rejected") {
    return (
      <Card>
        <CardHeader><CardTitle className="text-[20px]">Rejection Details</CardTitle></CardHeader>
        <CardContent>
          {rejectionReason ? (
            <div>
              <p className="text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">Rejection Reason</p>
              <p className="text-[14px] text-[hsl(220_13%_18%)]">{rejectionReason}</p>
            </div>
          ) : (
            <p className="text-[14px] text-[hsl(215_16%_47%)]">No rejection reason recorded.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Completed ──────────────────────────────────────────────────────────────
  return <ReadOnlyCard message="Completed" />;
}

function ReadOnlyCard({ message }: { message: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-[20px]">Actions</CardTitle></CardHeader>
      <CardContent>
        <p className="text-[14px] text-[hsl(215_16%_47%)]">{message}</p>
      </CardContent>
    </Card>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 border-t border-border" />
      <span className="text-[12px] text-[hsl(215_16%_47%)]">or</span>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

function RejectForm({
  value, onChange, charCount, canReject, isPending, onReject,
}: {
  value: string;
  onChange: (v: string) => void;
  charCount: number;
  canReject: boolean;
  isPending: boolean;
  onReject: () => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)]">
        Rejection Reason <span className="text-[hsl(0_72%_51%)]">*</span>
      </label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Explain why this engagement is being rejected..."
        disabled={isPending}
        className="min-h-[80px]"
      />
      <p className="text-[12px] text-[hsl(215_16%_47%)]">{charCount}/10 minimum characters</p>
      <Button
        onClick={onReject}
        disabled={isPending || !canReject}
        className="w-full h-11 bg-[hsl(0_72%_51%)] hover:bg-[hsl(0_72%_45%)] text-white disabled:opacity-50"
      >
        {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Rejecting...</> : "Reject"}
      </Button>
    </div>
  );
}
