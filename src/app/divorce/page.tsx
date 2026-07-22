import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import DivorceClient from "@/components/DivorceClient";
import { getDivorce } from "@/lib/store";
import { getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DivorcePage() {
  const role = await getRole();
  if (!role) redirect("/login");
  const divorce = await getDivorce();
  return (
    <div>
      <PageTitle>Divorce</PageTitle>
      <DivorceClient initial={divorce} admin={role === "admin"} />
    </div>
  );
}
