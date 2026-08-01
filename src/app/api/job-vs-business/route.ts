import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/store";

export async function PATCH(req: NextRequest) {
  const c = client();
  if (!c) return NextResponse.json({ error: "No database" }, { status: 503 });

  const body = await req.json();

  const { error } = await c
    .from("job_vs_business")
    .update(body)
    .limit(1);

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
