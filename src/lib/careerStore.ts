import { client } from "./store";
import {
  sortPaths,
  type ApplicationStatus,
  type CareerPath,
  type JobApplication,
  type NetworkSource,
  type PathStatus,
  type Resume,
  type SourceKind,
} from "./career";

// ── Career readers ───────────────────────────────────────────────────────────
// Server-side only (this pulls in the Supabase client). The shapes and the
// maths are in career.ts, which the browser shares.
//
// Every reader returns an empty list when its table isn't there yet, so the
// page opens and shows its empty states instead of erroring. The setup SQL is
// `supabase/career.sql`.

export async function getCareerPaths(): Promise<CareerPath[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c.from("career_paths").select("*");
  if (error || !data) return [];
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return sortPaths(
    data.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      whatItIs: row.what_it_is ?? null,
      whatItTakes: row.what_it_takes ?? null,
      payLow: num(row.pay_low),
      payHigh: num(row.pay_high),
      wantIt: Number(row.want_it ?? 3),
      paysEnough: Number(row.pays_enough ?? 3),
      easyToStart: Number(row.easy_to_start ?? 3),
      status: (row.status as PathStatus) ?? "Exploring",
      notes: row.notes ?? null,
    }))
  );
}

export async function getResumes(): Promise<Resume[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("resumes")
    .select("*")
    .order("uploaded_at", { ascending: false });
  if (error || !data) return [];
  return Promise.all(
    data.map(async (row) => {
      // The bucket is private, so the browser gets a link that expires rather
      // than a permanent public URL to a document with his address on it.
      const { data: signed } = await c.storage
        .from("resumes")
        .createSignedUrl(String(row.storage_path), 3600);
      return {
        id: String(row.id),
        label: String(row.label),
        aimedAt: row.aimed_at ?? null,
        fileName: String(row.file_name),
        uploadedAt: String(row.uploaded_at),
        url: signed?.signedUrl ?? null,
      };
    })
  );
}

// Read with `select("*")` and defaults on the three new fields, so this still
// works on a database where job_vs_business.sql ran but career.sql hasn't.
export async function getJobApplications(): Promise<JobApplication[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("job_postings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    companyName: String(row.company_name),
    roleTitle: String(row.role_title),
    salary: row.salary ?? null,
    link: row.link ?? null,
    status: (row.status as ApplicationStatus) ?? "Interested",
    notes: row.notes ?? null,
    appliedOn: row.applied_on ?? null,
    resumeId: row.resume_id ? String(row.resume_id) : null,
    pathId: row.path_id ? String(row.path_id) : null,
    createdAt: String(row.created_at),
  }));
}

export async function getNetworkSources(): Promise<NetworkSource[]> {
  const c = client();
  if (!c) return [];
  const { data, error } = await c
    .from("networking_sources")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    kind: (row.kind as SourceKind) ?? "Person",
    company: row.company ?? null,
    howToReach: row.how_to_reach ?? null,
    link: row.link ?? null,
    lastContact: row.last_contact ?? null,
    nextStep: row.next_step ?? null,
    notes: row.notes ?? null,
  }));
}
