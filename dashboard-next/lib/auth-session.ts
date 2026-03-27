export type SessionUser = {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
};

export type DashboardSession = {
  user: SessionUser;
  guildIDs: string[];
  expiresAt: number;
};

const SESSION_COOKIE = "poulet_dashboard_session";

function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function signValue(value: string): Promise<string> {
  const secret = process.env["DASHBOARD_SESSION_SECRET"];
  if (!secret) return "";

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  let binary = "";
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function readSessionCookieValue(token: string | undefined): Promise<DashboardSession | null> {
  if (!token) return null;

  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) return null;

  const expected = await signValue(payloadBase64);
  if (!expected || expected !== signature) return null;

  try {
    const session = JSON.parse(decodeBase64Url(payloadBase64)) as DashboardSession;
    if (session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}
