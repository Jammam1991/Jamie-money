import Link from "next/link";
import { PageTitle, Card } from "@/components/ui";
import LoginForm from "@/components/LoginForm";
import { getRole, adminConfigured, viewerConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const role = await getRole();

  return (
    <div>
      <PageTitle>Jamie&apos;s Money</PageTitle>
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
