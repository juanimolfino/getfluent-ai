import { getSupabaseAdmin } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60 * 10;

export async function storeAiResult(input: {
  userId: string;
  jobId: string;
  bytes: ArrayBuffer;
  contentType: string;
  extension: string;
}) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "ai-results";
  const path = `${input.userId}/${input.jobId}.${input.extension}`;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).upload(path, input.bytes, {
    upsert: true,
    contentType: input.contentType
  });
  if (error) throw error;

  return path;
}

export async function createSignedResultUrl(path: string, options?: { download?: boolean }) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "ai-results";
  const objectPath = normalizeStoragePath(path, bucket);
  if (!objectPath) return path;

  const { data, error } = await getSupabaseAdmin()
    .storage
    .from(bucket)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, { download: options?.download ?? false });

  if (error) throw error;
  return data.signedUrl;
}

export function normalizeStoragePath(pathOrUrl: string, bucket: string) {
  if (!pathOrUrl.startsWith("http://") && !pathOrUrl.startsWith("https://")) return pathOrUrl;

  try {
    const url = new URL(pathOrUrl);
    const publicPrefix = `/storage/v1/object/public/${bucket}/`;
    const signedPrefix = `/storage/v1/object/sign/${bucket}/`;
    if (url.pathname.startsWith(publicPrefix)) return decodeURIComponent(url.pathname.slice(publicPrefix.length));
    if (url.pathname.startsWith(signedPrefix)) return decodeURIComponent(url.pathname.slice(signedPrefix.length));
  } catch {
    return null;
  }

  return null;
}
