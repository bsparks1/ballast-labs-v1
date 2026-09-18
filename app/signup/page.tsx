import { Suspense } from "react";
import { Header } from "@/components/Header";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <>
      <Header />
      <div className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">Account</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="mt-2 text-sm text-muted">Email and password. Saved harnesses stay on this machine.</p>
        <Suspense>
          <SignupForm />
        </Suspense>
      </div>
    </>
  );
}
