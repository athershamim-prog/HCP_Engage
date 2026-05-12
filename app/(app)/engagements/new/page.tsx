import { EngagementForm } from "@/components/engagement/EngagementForm";

export const metadata = { title: "New Engagement — HCP Engage" };

export default function NewEngagementPage() {
  return (
    <div>
      <h1 className="text-[20px] font-semibold text-[hsl(220_13%_18%)] mb-1">New Engagement</h1>
      <p className="text-[14px] text-[hsl(215_16%_47%)] mb-8">
        Fill in the details below. Save as a draft to continue later, or submit directly for approval.
      </p>
      <EngagementForm />
    </div>
  );
}
