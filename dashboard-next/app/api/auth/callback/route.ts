import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionCookieValue,
  exchangeCodeForSession,
  readOAuthState,
  sessionCookieName,
  sessionCookieOptions,
  stateCookieName,
  stateCookieOptions,
} from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? undefined;
  const cookieStore = await cookies();
  const stateToken = cookieStore.get(stateCookieName())?.value;
  const oauthState = state && stateToken && state === stateToken ? await readOAuthState(state) : null;

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const origin = `${proto}://${host}`;

  if (!code || !oauthState) {
    const invalidResponse = NextResponse.redirect(new URL("/login?error=oauth", origin));
    invalidResponse.cookies.set(stateCookieName(), "", { ...stateCookieOptions(), maxAge: 0 });
    return invalidResponse;
  }

  try {
    const session = await exchangeCodeForSession(code);
    const response = NextResponse.redirect(new URL(oauthState.nextPath, origin));
    response.cookies.set(sessionCookieName(), await createSessionCookieValue(session), sessionCookieOptions());
    response.cookies.set(stateCookieName(), "", { ...stateCookieOptions(), maxAge: 0 });
    return response;
  } catch {
    const failedResponse = NextResponse.redirect(new URL("/login?error=oauth", origin));
    failedResponse.cookies.set(stateCookieName(), "", { ...stateCookieOptions(), maxAge: 0 });
    return failedResponse;
  }
}
