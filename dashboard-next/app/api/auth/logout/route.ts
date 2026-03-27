import { NextResponse } from "next/server";
import { sessionCookieName, sessionCookieOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const response = NextResponse.redirect(new URL("/login", req.url));
  response.cookies.set(sessionCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
