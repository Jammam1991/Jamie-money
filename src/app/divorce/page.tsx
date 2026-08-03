import { PageTitle } from "@/components/ui";
import DivorceClient from "@/components/DivorceClient";
import { getDivorce } from "@/lib/store";
import { requireVisible } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export default async function DivorcePage() {
  const role = await requireVisible("divorce");
  const divorce = await getDivorce();
  return (
    <div>
      <PageTitle>Divorce</PageTitle>
      <DivorceClient initial={divorce} admin={role === "admin"} />
    </div>
  );
}
