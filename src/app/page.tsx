import HomeClient from "@/components/HomeClient";
import { getSummary } from "@/lib/store";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [summary, admin] = await Promise.all([getSummary(), isAdmin()]);
  return <HomeClient initial={summary} admin={admin} />;
}
