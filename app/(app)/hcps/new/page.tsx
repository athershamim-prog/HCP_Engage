import { NpiLookupForm } from "@/components/hcp/NpiLookupForm";

export const metadata = { title: "Add HCP — HCP Engage" };

export default function NewHcpPage() {
  return (
    <div>
      <h1 className="text-[20px] font-semibold text-[hsl(220_13%_18%)] mb-1">Add HCP</h1>
      <p className="text-[14px] text-[hsl(215_16%_47%)] mb-8">
        Search by NPI to pull verified HCP data from NPPES
      </p>
      <NpiLookupForm />
    </div>
  );
}
