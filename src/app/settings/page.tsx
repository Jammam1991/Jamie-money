import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import SettingsClient from "@/components/SettingsClient";
import { getRole } from "@/lib/auth";
import { getHiddenPages } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const role = await getRole();
  if (role !== "admin") redirect("/login");

  const hidden = await getHiddenPages();

  return (
    <div>
      <PageTitle>Settings</PageTitle>
      <SettingsClient initialHidden={hidden} />
    </div>
  );
}
