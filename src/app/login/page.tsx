import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import LoginForm from "@/components/LoginForm";
import { getRole, adminConfigured, PIN_LENGTH } from "@/lib/auth";
import { getJamiePinHash } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}) {
  const [role, sp, pinHash] = await Promise.all([
    getRole(),
    searchParams,
    getJamiePinHash(),
  ]);

  // Already in? Straight to the dashboard — there's nothing to do here.
  if (role) redirect("/");

  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <span
          className="flex h-16 w-16 items-center justify-center rounded-3xl text-[28px] text-white shadow-sm"
          style={{ background: "linear-gradient(135deg, #12392e 0%, #167a5b 55%, #2aa37f 100%)" }}
          aria-hidden="true"
        >
          $
        </span>
        <h1 className="mt-4 text-[24px] font-semibold">Jamie&apos;s Money</h1>
        <p className="mt-1 text-[14px] text-muted">Everything in one place.</p>
      </div>
      {/* Landing here from a link means it sat unread too long. Say so, so it
          doesn't read as "your link was wrong" or as something being broken. */}
      {sp.link === "expired" && (
        <Card className="mb-3">
          <p className="text-[14px] font-medium">That link has expired.</p>
          <p className="text-[13px] text-muted">
            Links only last a few minutes. Your PIN always works, though —
            tap it in below.
          </p>
        </Card>
      )}
      <Card className="rounded-3xl p-6">
        <LoginForm pinLength={PIN_LENGTH} pinReady={Boolean(pinHash)} />
      </Card>

      {!adminConfigured() && (
        <p className="mt-3 text-xs text-muted">
          Setup note: add <code>ADMIN_PASSWORD</code> as an environment variable
          in Vercel, then redeploy. Jamie&apos;s PIN is set in the app, on
          Settings.
        </p>
      )}
    </div>
  );
}
