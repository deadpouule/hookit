import { timingSafeEqual } from "node:crypto";

/** Shared gate for privileged Next.js API routes (hook compile/deploy, verify). */

export function adminAuthorized(request: Request): boolean {
  const expected = process.env.HOOKIT_ADMIN_KEY?.trim();
  if (!expected) return false;
  const provided =
    request.headers.get("x-hookit-admin")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  return secretEquals(provided, expected);
}

/** Constant-time comparison so response timing does not leak how much of the key matched. */
export function secretEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Still burn a comparison of the expected length before rejecting.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function adminUnauthorizedResponse(): Response {
  return Response.json(
    { error: "Unauthorized. Set HOOKIT_ADMIN_KEY and send it as x-hookit-admin." },
    { status: 401 },
  );
}
