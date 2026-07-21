import { getBills } from "@/lib/store";

export async function GET() {
  const bills = await getBills();
  return Response.json(bills);
}
