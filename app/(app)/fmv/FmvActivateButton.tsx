"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateRateCardAction } from "@/actions/fmv";

export function FmvActivateButton({ rateCardId }: { rateCardId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await activateRateCardAction(rateCardId);
          if (result.success) router.refresh();
        })
      }
      className="text-[14px] font-medium border border-[hsl(221_83%_53%)] text-[hsl(221_83%_53%)] rounded-md px-3 py-1 hover:bg-[hsl(221_83%_53%/0.1)] disabled:opacity-50"
    >
      {isPending ? "Activating..." : "Activate"}
    </button>
  );
}
