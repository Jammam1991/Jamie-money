import { NextRequest, NextResponse } from "next/server";
import { client } from "@/lib/store";

export async function POST(req: NextRequest) {
  const c = client();
  if (!c) return NextResponse.json({ error: "No database" }, { status: 503 });

  const body = await req.json();

  const { data, error } = await c
    .from("job_postings")
    .insert([body])
    .select()
    .single();

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({
    id: String(data.id),
    companyName: data.company_name,
    roleTitle: data.role_title,
    salary: data.salary,
    link: data.link,
    status: data.status,
    notes: data.notes,
    createdAt: data.created_at,
  });
}
