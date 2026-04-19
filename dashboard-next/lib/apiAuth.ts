import { getSessionFromCookies } from "@/lib/auth";

const INTERNAL_API_HEADER = "x-dashboard-internal-secret";

export function hasValidInternalApiSecret(request: Request): boolean {
  const expected = process.env["DASHBOARD_INTERNAL_API_SECRET"];
  if (!expected) return false;
  return request.headers.get(INTERNAL_API_HEADER) === expected;
}

export async function hasGuildAccess(request: Request, guildId: string): Promise<boolean> {
  if (hasValidInternalApiSecret(request)) return true;
  const session = await getSessionFromCookies();
  return Boolean(session && session.guildIDs.includes(guildId));
}
