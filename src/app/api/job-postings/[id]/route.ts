import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/store";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const c = client();
  if (!c) return NextResponse.json({ error: "No database" }, { status: 503 });

  const body = await req.json();

  const { error } = await c.from("job_postings").update(body).eq("id", id);

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const c = client();
  if (!c) return NextResponse.json({ error: "No database" }, { status: 503 });

  const { error } = await c.from("job_postings").delete().eq("id", id);

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
