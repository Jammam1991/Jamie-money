"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, LogOut, Activity, Settings, KeyRound } from "lucide-react";
import { logout, toggleViewAsJamie } from "@/lib/actions";

// A small control in the top-right corner. Once logged in, everyone gets the
// password book and a log-out button; the admin also gets a link to Jamie's
// login activity and a toggle to view as Jamie.
export default function AdminBar({
  admin,
  loggedIn,
  viewingAsJamie,
}: {
  admin: boolean;
  loggedIn: boolean;
  viewingAsJamie: boolean;
}) {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    await toggleViewAsJamie();
    setToggling(false);
  };

  return (
    <div className="mb-1 flex justify-end gap-4">
      {loggedIn && (
        <Link
          href="/passwords"
          className="flex items-center gap-1 text-[12px] text-muted"
        >
          <KeyRound size={13} />
          Passwords
        </Link>
      )}
      {admin && !viewingAsJamie && (
        <Link
          href="/activity"
          className="flex items-center gap-1 text-[12px] text-muted"
        >
          <Activity size={13} />
          Activity
        </Link>
      )}
      {admin && !viewingAsJamie && (
        <Link
          href="/settings"
          className="flex items-center gap-1 text-[12px] text-muted"
        >
          <Settings size={13} />
          Settings
        </Link>
      )}
      {admin && (
        <button
          onClick={handleToggle}
          disabled={toggling}
          className="flex items-center gap-1 text-[12px] text-muted hover:opacity-70 disabled:opacity-50 transition-opacity"
        >
          {viewingAsJamie ? "← Admin" : "View as Jamie"}
        </button>
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
