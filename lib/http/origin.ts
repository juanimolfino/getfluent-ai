function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isAllowedRequestOrigin(request: Request) {
  const origin = normalizeOrigin(request.headers.get("origin"));
  if (!origin) return true;

  const requestOrigin = normalizeOrigin(request.url);
  const appOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);

  return origin === requestOrigin || (Boolean(appOrigin) && origin === appOrigin);
}
