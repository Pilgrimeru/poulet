import { NextResponse } from "next/server";
import { getAppUrl, sessionCookieName, sessionCookieOptions } from "@/lib/auth";

export async function GET() {
  const response = NextResponse.redirect(new URL("/login", getAppUrl()));
  response.cookies.set(sessionCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
