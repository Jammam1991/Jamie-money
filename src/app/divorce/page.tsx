import { PageTitle } from "@/components/ui";
import DivorceClient from "@/components/DivorceClient";
import { getDivorce } from "@/lib/store";
import { pageGate } from "@/lib/visibility";
import ComingSoon from "@/components/ComingSoon";

export const dynamic = "force-dynamic";

export default async function DivorcePage() {
  const { role, comingSoon } = await pageGate("divorce");
  if (comingSoon) return <ComingSoon title="Divorce" />;
  const divorce = await getDivorce();
  return (
    <div>
      <PageTitle>Divorce</PageTitle>
      <DivorceClient initial={divorce} admin={role === "admin"} />
    </div>
  );
}
