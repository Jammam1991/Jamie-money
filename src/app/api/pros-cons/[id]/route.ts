import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/store";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const c = client();
  if (!c) return NextResponse.json({ error: "No database" }, { status: 503 });

  const { error } = await c.from("business_pros_cons").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
