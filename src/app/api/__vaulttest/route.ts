// TEMPORARY — deleted before commit. Round-trips the vault crypto.
import { NextResponse } from "next/server";
import { seal, unseal, aad, vaultConfigured } from "@/lib/passwords";

export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, unknown> = { configured: vaultConfigured() };
  const secret = "Tr0ub4dor&3 — üñïçødé ✅";
  const blob = seal(secret, aad("row-1", "password"));
  out.blobLooksScrambled = !blob.includes("Tr0ub4dor");
  out.roundTrip = unseal(blob, aad("row-1", "password")) === secret;

  // Same ciphertext, different row → must refuse.
  try { unseal(blob, aad("row-2", "password")); out.wrongRowRejected = false; }
  catch { out.wrongRowRejected = true; }

  // Same row, different field → must refuse.
  try { unseal(blob, aad("row-1", "notes")); out.wrongFieldRejected = false; }
  catch { out.wrongFieldRejected = true; }

  // One character changed → must refuse.
  const parts = blob.split(":");
  const body = Buffer.from(parts[3], "base64"); body[0] ^= 0x01;
  const tampered = [parts[0], parts[1], parts[2], body.toString("base64")].join(":");
  try { unseal(tampered, aad("row-1", "password")); out.tamperRejected = false; }
  catch { out.tamperRejected = true; }

  // Two seals of the same text must not look alike.
  out.noRepeats = seal(secret, aad("row-1", "password")) !== seal(secret, aad("row-1", "password"));
  out.emptyIsEmpty = unseal(null, aad("row-1", "notes")) === "";
  return NextResponse.json(out);
}
