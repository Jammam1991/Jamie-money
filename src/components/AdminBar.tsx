import Link from "next/link";
import { Lock, LogOut } from "lucide-react";
import { logout } from "@/lib/actions";

// A small control in the top-right corner: a lock to log in, or a log-out
// button once you're in. Kept subtle so Jamie's view stays clean.
export default function AdminBar({ admin }: { admin: boolean }) {
  return (
    <div className="mb-1 flex justify-end">
      {admin ? (
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
          aria-label="Log in to edit"
          className="flex items-center gap-1 text-[12px] text-muted"
        >
          <Lock size={13} />
          Log in
        </Link>
      )}
    </div>
  );
}
