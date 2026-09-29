import { Header } from "@/components/Header";
import { requireUser } from "@/lib/auth/current-user";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  await requireUser("/settings");

  return (
    <>
      <Header />
      <div className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <p className="eyebrow">Account</p>
        <h1 className="mt-2 display-md">Settings</h1>
        <p className="mt-2 text-sm text-muted">Manage the sessions tied to this account.</p>
        <SettingsForm />
      </div>
    </>
  );
}
