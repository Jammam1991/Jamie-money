import Link from "next/link";
import { PageTitle, Card } from "@/components/ui";
import LoginForm from "@/components/LoginForm";
import { isAdmin, adminConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const admin = await isAdmin();

  return (
    <div>
      <PageTitle>Manage</PageTitle>
      <Card>
        {admin ? (
          <div className="space-y-1">
            <p className="text-[15px] font-medium">You&apos;re logged in.</p>
            <p className="text-[13px] text-muted">
              You can edit bills, income, debts, and divorce details. Head to any
              tab to make changes.
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

      {!adminConfigured() && (
        <p className="mt-3 text-xs text-muted">
          Heads up: no password has been set yet. Add an{" "}
          <code>ADMIN_PASSWORD</code> environment variable in Vercel, then log in
          here.
        </p>
      )}
    </div>
  );
}
