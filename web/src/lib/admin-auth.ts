/** Shared gate for privileged Next.js API routes (hook compile/deploy, verify). */

export function adminAuthorized(request: Request): boolean {
  const expected = process.env.HOOKIT_ADMIN_KEY?.trim();
  if (!expected) return false;
  const provided =
    request.headers.get("x-hookit-admin")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  return provided === expected;
}

export function adminUnauthorizedResponse(): Response {
  return Response.json(
    { error: "Unauthorized. Set HOOKIT_ADMIN_KEY and send it as x-hookit-admin." },
    { status: 401 },
  );
}
