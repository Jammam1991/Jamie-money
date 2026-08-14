import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { PageTitle, Card } from "@/components/ui";
import PasswordsClient from "@/components/PasswordsClient";
import VaultUnlock from "@/components/VaultUnlock";
import { getRole, isVaultUnlocked, VAULT_MINUTES } from "@/lib/auth";
import { getPasswordEntries, vaultConfigured } from "@/lib/passwords";

export const dynamic = "force-dynamic";

// Nothing about this page belongs in a search engine, or in a preview card in
// somebody's chat app.
export const metadata: Metadata = {
  title: "Passwords",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PasswordsPage() {
  const role = await getRole();
  if (!role) redirect("/login");

  const unlocked = await isVaultUnlocked();

  // The list is fetched only once the second lock is open — and even then it's
  // labels only. Real passwords never arrive with the page.
  const entries = unlocked ? await getPasswordEntries() : [];

  return (
    <div>
      <PageTitle>Passwords</PageTitle>

      {!vaultConfigured() ? (
        <Card>
          <p className="text-[15px] font-medium">The password book isn&apos;t set up yet.</p>
          <p className="mt-1 text-[13px] text-muted">
            Add <code>PASSWORDS_KEY</code> as an environment variable in Vercel
            and redeploy. That key is what locks and unlocks everything saved
            here — without it, nothing can be stored.
          </p>
        </Card>
      ) : !unlocked ? (
        <VaultUnlock minutes={VAULT_MINUTES} />
      ) : (
        <>
          <p className="mb-3 flex items-center gap-1.5 text-[13px] text-muted">
            <KeyRound size={14} />
            Open for {VAULT_MINUTES} minutes, then it locks itself again.
          </p>
          <PasswordsClient entries={entries} />
        </>
      )}
    </div>
  );
}
