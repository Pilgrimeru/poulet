import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readSessionCookieValue, sessionCookieName } from "@/lib/auth-session";

const PUBLIC_PATHS = new Set(["/login"]);
const INTERNAL_API_HEADER = "x-dashboard-internal-secret";

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

function isAuthorizedInternalApiRequest(req: NextRequest): boolean {
  if (!req.nextUrl.pathname.startsWith("/api/")) return false;
  const expectedSecret = process.env["DASHBOARD_INTERNAL_API_SECRET"] ?? process.env["TOKEN"];
  if (!expectedSecret) return false;
  return req.headers.get(INTERNAL_API_HEADER) === expectedSecret;
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map)$/)
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (isAuthorizedInternalApiRequest(req)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const session = await readSessionCookieValue(req.cookies.get(sessionCookieName())?.value);
  const isAuthenticated = session !== null;

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && isAuthenticated) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (isAuthenticated) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginURL = new URL("/login", req.url);
  loginURL.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginURL);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
