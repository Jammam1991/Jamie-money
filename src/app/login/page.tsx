import Link from "next/link";
import { PageTitle, Card } from "@/components/ui";
import LoginForm from "@/components/LoginForm";
import { getRole, adminConfigured, viewerConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}) {
  const [role, sp] = await Promise.all([getRole(), searchParams]);

  return (
    <div>
      <PageTitle>Jamie&apos;s Money</PageTitle>
      {/* Landing here from a link means it sat unread too long. Say so, so it
          doesn't read as "your link was wrong" or as something being broken. */}
      {sp.link === "expired" && !role && (
        <Card className="mb-3">
          <p className="text-[14px] font-medium">That link has expired.</p>
          <p className="text-[13px] text-muted">
            Login links only last a few minutes. Ask Chris to send a fresh one,
            or type your password below.
          </p>
        </Card>
      )}
      <Card>
        {role ? (
          <div className="space-y-1">
            <p className="text-[15px] font-medium">
              You&apos;re logged in{role === "admin" ? " as the manager" : ""}.
            </p>
            <p className="text-[13px] text-muted">
              {role === "admin"
                ? "You can view everything and edit bills, income, debts, and divorce details."
                : "You can view Jamie's bills, income, debts, and divorce details."}
            </p>
            <Link
              href="/"
              className="mt-2 inline-block text-[13px]"
              style={{ color: "var(--good)" }}
            >
              Go to app →
            </Link>
          </div>
        ) : (
          <LoginForm />
        )}
      </Card>

      {(!adminConfigured() || !viewerConfigured()) && (
        <p className="mt-3 text-xs text-muted">
          Setup note: add <code>ADMIN_PASSWORD</code> (yours, to edit) and{" "}
          <code>JAMIE_PASSWORD</code> (Jamie&apos;s, to view) as environment
          variables in Vercel, then redeploy.
        </p>
      )}
    </div>
  );
}
