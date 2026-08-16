import ComingSoon from "@/components/ComingSoon";
import GymLeaseClient from "@/components/GymLeaseClient";
import { pageGate } from "@/lib/visibility";
import { CURRENT_LEASE, getLeaseOpportunities } from "@/lib/gymLease";

export const dynamic = "force-dynamic";

export default async function GymLeasePage() {
  const { comingSoon } = await pageGate("gym-lease");
  if (comingSoon) return <ComingSoon title="Gym Lease" />;

  const { opportunities, problem } = await getLeaseOpportunities();

  return (
    <div>
      <GymLeaseClient lease={CURRENT_LEASE} opportunities={opportunities} problem={problem} />
    </div>
  );
}
