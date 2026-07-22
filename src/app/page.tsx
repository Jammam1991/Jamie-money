import { redirect } from "next/navigation";
import HomeClient from "@/components/HomeClient";
import { getSummary } from "@/lib/store";
import { getRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const role = await getRole();
  if (!role) redirect("/login");
  const summary = await getSummary();
  return <HomeClient initial={summary} admin={role === "admin"} />;
}
