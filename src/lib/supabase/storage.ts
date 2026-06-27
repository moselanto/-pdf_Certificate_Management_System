import type { SupabaseClient } from "@supabase/supabase-js";

const TEMPLATE_BUCKET = process.env.SUPABASE_TEMPLATE_BUCKET ?? "templates";
const CERT_BUCKET = process.env.SUPABASE_CERTIFICATE_BUCKET ?? "certificates";

/** Download stored bytes (e.g. a template PDF) into a Uint8Array. */
export async function downloadBytes(
  client: SupabaseClient,
  bucket: string,
  path: string,
): Promise<Uint8Array> {
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`download failed: ${error?.message ?? path}`);
  return new Uint8Array(await data.arrayBuffer());
}

export const downloadTemplate = (c: SupabaseClient, path: string) =>
  downloadBytes(c, TEMPLATE_BUCKET, path);

/** Upload generated certificate PDF bytes; returns the storage path. */
export async function uploadCertificate(
  client: SupabaseClient,
  certificateNumber: string,
  bytes: Uint8Array,
): Promise<string> {
  const path = `${new Date().getFullYear()}/${certificateNumber}.pdf`;
  const { error } = await client.storage
    .from(CERT_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`upload failed: ${error.message}`);
  return path;
}

export { TEMPLATE_BUCKET, CERT_BUCKET };
