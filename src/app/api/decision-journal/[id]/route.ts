import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/store";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const c = client();
  if (!c) return NextResponse.json({ error: "No database" }, { status: 503 });

  const { error } = await c.from("decision_journal").delete().eq("id", id);

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
