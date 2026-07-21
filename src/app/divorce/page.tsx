import { PageTitle } from "@/components/ui";
import DivorceClient from "@/components/DivorceClient";
import { getDivorce } from "@/lib/store";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DivorcePage() {
  const [divorce, admin] = await Promise.all([getDivorce(), isAdmin()]);
  return (
    <div>
      <PageTitle>Divorce</PageTitle>
      <DivorceClient initial={divorce} admin={admin} />
    </div>
  );
}
