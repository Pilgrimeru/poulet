import path from "path";
import { config as dotenvConfig } from "dotenv";
import { cookies } from "next/headers";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const SESSION_COOKIE = "poulet_dashboard_session";
const STATE_COOKIE = "poulet_dashboard_oauth_state";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const STATE_MAX_AGE_SECONDS = 60 * 10;

type DiscordOAuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
};

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

const globalForAuthEnv = globalThis as typeof globalThis & { __dashboardAuthEnvLoaded?: boolean };

function ensureEnvLoaded(): void {
  if (globalForAuthEnv.__dashboardAuthEnvLoaded) return;
  dotenvConfig({ path: path.resolve(process.cwd(), "config.env"), quiet: true });
  dotenvConfig({ path: path.resolve(process.cwd(), "../config.env"), override: false, quiet: true });
  globalForAuthEnv.__dashboardAuthEnvLoaded = true;
}

function getRequiredEnv(name: string): string {
  ensureEnvLoaded();
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string): string | null {
  ensureEnvLoaded();
  return process.env[name] ?? null;
}

function toBase64Url(text: string): string {
  return Buffer.from(text, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

async function signValue(value: string): Promise<string> {
  const secret = getRequiredEnv("DASHBOARD_SESSION_SECRET");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Buffer.from(signature).toString("base64url");
}

async function createSignedToken(payload: string): Promise<string> {
  const payloadBase64 = toBase64Url(payload);
  const signature = await signValue(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

async function readSignedToken<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;

  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) return null;

  const expected = await signValue(payloadBase64);
  if (signature !== expected) return null;

  try {
    return JSON.parse(fromBase64Url(payloadBase64)) as T;
  } catch {
    return null;
  }
}

function discordAvatarURL(userID: string, avatar: string | null): string {
  if (!avatar) return "";
  const extension = avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userID}/${avatar}.${extension}?size=128`;
}

export function getDiscordLoginURL(stateToken: string): string {
  const params = new URLSearchParams({
    client_id: getRequiredEnv("DISCORD_CLIENT_ID"),
    response_type: "code",
    redirect_uri: getRequiredEnv("DISCORD_REDIRECT_URI"),
    scope: "identify guilds",
    state: stateToken,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function createOAuthState(nextPath: string): Promise<string> {
  return createSignedToken(JSON.stringify({
    nextPath,
    nonce: crypto.randomUUID(),
    createdAt: Date.now(),
  }));
}

export async function readOAuthState(token: string | undefined): Promise<{ nextPath: string; nonce: string; createdAt: number } | null> {
  const payload = await readSignedToken<{ nextPath: string; nonce: string; createdAt: number }>(token);
  if (!payload) return null;
  if (Date.now() - payload.createdAt > STATE_MAX_AGE_SECONDS * 1000) return null;
  return payload;
}

export async function createSessionCookieValue(session: DashboardSession): Promise<string> {
  return createSignedToken(JSON.stringify(session));
}

export async function readSessionCookieValue(token: string | undefined): Promise<DashboardSession | null> {
  const session = await readSignedToken<DashboardSession>(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) return null;
  return session;
}

export async function getSessionFromCookies(): Promise<DashboardSession | null> {
  const cookieStore = await cookies();
  return readSessionCookieValue(cookieStore.get(SESSION_COOKIE)?.value);
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

export function stateCookieName(): string {
  return STATE_COOKIE;
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  const secure = getOptionalEnv("NODE_ENV") === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge,
  };
}

export function stateCookieOptions() {
  return sessionCookieOptions(STATE_MAX_AGE_SECONDS);
}

export async function exchangeCodeForSession(code: string): Promise<DashboardSession> {
  const body = new URLSearchParams({
    client_id: getRequiredEnv("DISCORD_CLIENT_ID"),
    client_secret: getRequiredEnv("DISCORD_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: getRequiredEnv("DISCORD_REDIRECT_URI"),
  });

  const tokenResponse = await fetch(`${DISCORD_API_BASE.replace("/api/v10", "/api/oauth2/token")}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    throw new Error(`Discord token exchange failed: ${tokenResponse.status}`);
  }

  const token = await tokenResponse.json() as DiscordOAuthTokenResponse;
  const headers = {
    Authorization: `${token.token_type} ${token.access_token}`,
  };

  const [userResponse, guildsResponse] = await Promise.all([
    fetch(`${DISCORD_API_BASE}/users/@me`, { headers, cache: "no-store" }),
    fetch(`${DISCORD_API_BASE}/users/@me/guilds`, { headers, cache: "no-store" }),
  ]);

  if (!userResponse.ok) {
    throw new Error(`Discord user fetch failed: ${userResponse.status}`);
  }

  if (!guildsResponse.ok) {
    throw new Error(`Discord guilds fetch failed: ${guildsResponse.status}`);
  }

  const user = await userResponse.json() as DiscordUser;
  const guilds = await guildsResponse.json() as DiscordGuild[];

  return {
    user: {
      id: user.id,
      username: user.username,
      globalName: user.global_name,
      avatar: discordAvatarURL(user.id, user.avatar),
    },
    guildIDs: guilds.map((guild) => guild.id),
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
}

export function normalizeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  return value;
}
