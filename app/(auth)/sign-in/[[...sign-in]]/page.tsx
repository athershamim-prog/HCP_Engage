import { SignIn } from "@clerk/nextjs";

export const metadata = {
  title: "Sign In — HCP Engage",
};

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[hsl(0_0%_98%)] px-4">
      <div className="mb-8 text-center">
        <h1 className="text-[28px] font-semibold text-[hsl(220_13%_18%)] leading-[1.15]">
          HCP Engage
        </h1>
        <p className="text-[12px] text-[hsl(215_16%_47%)] mt-1">
          Pharma commercial compliance
        </p>
      </div>
      <div className="w-full max-w-[480px]">
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-sm border border-[hsl(220_13%_91%)] rounded-lg",
              headerTitle: "text-[20px] font-semibold",
              headerSubtitle: "text-[14px] text-[hsl(215_16%_47%)]",
              socialButtonsBlockButton: "hidden",
              dividerRow: "hidden",
              footerActionLink: "hidden",
            },
          }}
          routing="path"
          path="/sign-in"
          signUpUrl={undefined}
          fallbackRedirectUrl="/hcps"
        />
      </div>
    </div>
  );
}
