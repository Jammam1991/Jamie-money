import { PageTitle } from "@/components/ui";
import ComingSoon from "@/components/ComingSoon";
import CarsClient from "@/components/CarsClient";
import { getDebts, getCarInfo, getCarHistory } from "@/lib/store";
import { pageGate } from "@/lib/visibility";

export const dynamic = "force-dynamic";

export default async function CarsPage() {
  const { comingSoon } = await pageGate("cars");
  if (comingSoon) return <ComingSoon title="Cars" />;

  const [debts, carInfo, carHistory] = await Promise.all([
    getDebts(),
    getCarInfo(),
    getCarHistory(),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageTitle>Cars</PageTitle>
      <p className="-mt-2 mb-4 text-[13px] text-muted">
        The Taycan&apos;s loan, what it&apos;s really worth, and what came before it.
      </p>
      <CarsClient
        debts={debts}
        initialInfo={carInfo}
        initialHistory={carHistory}
        today={today}
      />
    </div>
  );
}
