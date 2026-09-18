import { Suspense } from "react";
import { Header } from "@/components/Header";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <>
      <Header />
      <div className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-accent">Account</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Prototype auth — enough to tie saved harnesses to you. Not SSO.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </>
  );
}
