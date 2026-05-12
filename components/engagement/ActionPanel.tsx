"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/actions/engagement";
import type { EngagementStatusValue } from "@/components/engagement/EngagementStatusBadge";

interface ActionPanelProps {
  engagementId: string;
  status: EngagementStatusValue;
  submittedByClerkId: string;
  currentUserClerkId: string;
  effectiveRoles: string[];
  rejectionReason?: string | null;
}

export function ActionPanel({
  engagementId,
  status,
  submittedByClerkId,
  currentUserClerkId,
  effectiveRoles,
  rejectionReason,
}: ActionPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectionText, setRejectionText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isOwner = submittedByClerkId === currentUserClerkId;
  const isComplianceOrFinance =
    effectiveRoles.includes("compliance") || effectiveRoles.includes("finance");
  const isBusinessRole =
    effectiveRoles.includes("business") &&
    !effectiveRoles.includes("compliance") &&
    !effectiveRoles.includes("finance");

  const rejectionTextLength = rejectionText.trim().length;
  const canReject = rejectionTextLength >= 10;

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveEngagementAction(engagementId);
      if (!result.success) {
        setError(result.error ?? "Action failed. Refresh the page and try again.");
      } else {
        toast.success("Engagement approved.");
        router.refresh();
      }
    });
  }

  function handleReject() {
    if (!canReject) return;
    setError(null);
    startTransition(async () => {
      const result = await rejectEngagementAction(engagementId, rejectionText);
      if (!result.success) {
        setError(result.error ?? "Action failed. Refresh the page and try again.");
      } else {
        toast.success("Engagement rejected.");
        router.refresh();
      }
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitEngagementAction(engagementId);
      if (!result.success) {
        setError(result.error ?? "Could not submit the engagement. Refresh the page and try again.");
      } else {
        toast.success("Engagement submitted for approval.");
        router.refresh();
      }
    });
  }

  function handleComplete() {
    setError(null);
    startTransition(async () => {
      const result = await completeEngagementAction(engagementId);
      if (!result.success) {
        setError(result.error ?? "Action failed. Refresh the page and try again.");
      } else {
        toast.success("Engagement marked as completed.");
        router.refresh();
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteEngagementAction(engagementId);
      if (!result.success) {
        setError(result.error ?? "Action failed. Refresh the page and try again.");
      } else {
        toast.success("Draft deleted.");
        router.push("/engagements");
      }
    });
  }

  return (
    <Card>
      {/* Draft — owner */}
      {status === "draft" && isOwner && (
        <>
          <CardHeader>
            <CardTitle className="text-[20px]">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="w-full h-11 bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] text-white"
              aria-label="Submit engagement for approval"
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

            {/* Delete draft link — triggers AlertDialog */}
            <AlertDialog>
              <AlertDialogTrigger
                disabled={isPending}
                className="block w-full text-center text-[12px] text-[hsl(0_72%_51%)] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete this draft
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete engagement draft?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. The draft will be permanently deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel variant="outline">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-[hsl(0_72%_51%)] text-white hover:bg-[hsl(0_72%_45%)]"
                  >
                    Delete Draft
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {error && (
              <p className="text-[12px] text-[hsl(0_72%_51%)]">{error}</p>
            )}
          </CardContent>
        </>
      )}

      {/* Draft — non-owner */}
      {status === "draft" && !isOwner && (
        <>
          <CardHeader>
            <CardTitle className="text-[20px]">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[14px] text-[hsl(215_16%_47%)]">
              Draft — waiting for submission
            </p>
          </CardContent>
        </>
      )}

      {/* Submitted — compliance or finance: show approve/reject form */}
      {status === "submitted" && isComplianceOrFinance && (
        <>
          <CardHeader>
            <CardTitle className="text-[20px]">Review Engagement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Approve button */}
            <Button
              onClick={handleApprove}
              disabled={isPending}
              className="w-full h-11 bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] text-white"
              aria-label="Approve engagement"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                  Approving...
                </>
              ) : (
                "Approve"
              )}
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-border" />
              <span className="text-[12px] text-[hsl(215_16%_47%)]">or</span>
              <div className="flex-1 border-t border-border" />
            </div>

            {/* Rejection textarea */}
            <div>
              <label className="block text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
                Rejection Reason <span className="text-[hsl(0_72%_51%)]">*</span>
              </label>
              <Textarea
                value={rejectionText}
                onChange={(e) => setRejectionText(e.target.value)}
                placeholder="Explain why this engagement is being rejected..."
                disabled={isPending}
                className="min-h-[80px]"
                aria-label="Rejection reason"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[12px] text-[hsl(215_16%_47%)]">
                  {rejectionTextLength}/10 minimum characters
                </span>
              </div>
            </div>

            {/* Reject button */}
            <Button
              onClick={handleReject}
              disabled={isPending || !canReject}
              className="w-full h-11 bg-[hsl(0_72%_51%)] hover:bg-[hsl(0_72%_45%)] text-white disabled:opacity-50"
              aria-label="Reject engagement"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                  Rejecting...
                </>
              ) : (
                "Reject"
              )}
            </Button>

            {error && (
              <p className="text-[12px] text-[hsl(0_72%_51%)]">{error}</p>
            )}
          </CardContent>
        </>
      )}

      {/* Submitted — business user: read-only */}
      {status === "submitted" && isBusinessRole && (
        <>
          <CardHeader>
            <CardTitle className="text-[20px]">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[14px] text-[hsl(215_16%_47%)]">
              Pending Approval
            </p>
          </CardContent>
        </>
      )}

      {/* Approved — owner: mark as completed */}
      {status === "approved" && isOwner && (
        <>
          <CardHeader>
            <CardTitle className="text-[20px]">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleComplete}
              disabled={isPending}
              className="w-full h-11 bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] text-white"
              aria-label="Mark engagement as completed"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                  Completing...
                </>
              ) : (
                "Mark as Completed"
              )}
            </Button>

            {error && (
              <p className="text-[12px] text-[hsl(0_72%_51%)]">{error}</p>
            )}
          </CardContent>
        </>
      )}

      {/* Approved — non-owner: read-only */}
      {status === "approved" && !isOwner && (
        <>
          <CardHeader>
            <CardTitle className="text-[20px]">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[14px] text-[hsl(215_16%_47%)]">Approved</p>
          </CardContent>
        </>
      )}

      {/* Rejected — any: show rejection reason display */}
      {status === "rejected" && (
        <>
          <CardHeader>
            <CardTitle className="text-[20px]">Rejection Details</CardTitle>
          </CardHeader>
          <CardContent>
            {rejectionReason ? (
              <div>
                <p className="text-[12px] font-semibold text-[hsl(220_13%_18%)] mb-1">
                  Rejection Reason
                </p>
                <p className="text-[14px] text-[hsl(220_13%_18%)]">
                  {rejectionReason}
                </p>
              </div>
            ) : (
              <p className="text-[14px] text-[hsl(215_16%_47%)]">
                No rejection reason recorded.
              </p>
            )}
          </CardContent>
        </>
      )}

      {/* Completed — any: read-only */}
      {status === "completed" && (
        <>
          <CardHeader>
            <CardTitle className="text-[20px]">Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[14px] text-[hsl(215_16%_47%)]">Completed</p>
          </CardContent>
        </>
      )}
    </Card>
  );
}
