import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/store";

export async function POST(req: NextRequest) {
  const c = client();
  if (!c) return NextResponse.json({ error: "No database" }, { status: 503 });

  const body = await req.json();

  const { data, error } = await c
    .from("business_pros_cons")
    .insert([body])
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({
    id: String(data.id),
    type: data.type,
    text: data.text,
    sort: Number(data.sort),
  });
}
