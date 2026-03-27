import { NextResponse } from "next/server";
import {
  createOAuthState,
  getDiscordLoginURL,
  normalizeNextPath,
  stateCookieName,
  stateCookieOptions,
} from "@/lib/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const nextPath = normalizeNextPath(url.searchParams.get("next"));
  const state = await createOAuthState(nextPath);
  const response = NextResponse.redirect(getDiscordLoginURL(state));
  response.cookies.set(stateCookieName(), state, stateCookieOptions());
  return response;
}
