import { Metadata } from "next";
import { FmvUploadWizard } from "./FmvUploadWizard";

export const metadata: Metadata = {
  title: "Upload Rate Card — HCP Engage",
};

export default function FmvUploadPage() {
  return (
    <div>
      <h1 className="text-[20px] font-semibold text-[hsl(220_13%_18%)] mb-1">
        Upload Rate Card
      </h1>
      <p className="text-[14px] text-[hsl(215_16%_47%)] mb-8">
        Upload an Excel or CSV file to create a new FMV rate card version
      </p>
      <FmvUploadWizard />
    </div>
  );
}
