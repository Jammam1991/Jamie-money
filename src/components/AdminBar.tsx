import Link from "next/link";
import { Lock, LogOut, Activity } from "lucide-react";
import { logout } from "@/lib/actions";

// A small control in the top-right corner. Once logged in, everyone gets a
// log-out button; the admin also gets a link to Jamie's login activity.
export default function AdminBar({
  admin,
  loggedIn,
}: {
  admin: boolean;
  loggedIn: boolean;
}) {
  return (
    <div className="mb-1 flex justify-end gap-4">
      {admin && (
        <Link
          href="/activity"
          className="flex items-center gap-1 text-[12px] text-muted"
        >
          <Activity size={13} />
          Activity
        </Link>
      )}
      {loggedIn ? (
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-1 text-[12px] text-muted"
          >
            <LogOut size={13} />
            Log out
          </button>
        </form>
      ) : (
        <Link
          href="/login"
          aria-label="Log in"
          className="flex items-center gap-1 text-[12px] text-muted"
        >
          <Lock size={13} />
          Log in
        </Link>
      )}
    </div>
  );
}
