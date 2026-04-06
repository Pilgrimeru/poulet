import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "poulet_dashboard_session";
const INTERNAL_API_HEADER = "x-dashboard-internal-secret";

const FALLBACK_ORIGIN = process.env["APP_URL"] ?? "http://localhost:3000";

function getPublicOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  // Ignore internal binding addresses — use APP_URL fallback instead
  if (host && !host.startsWith("0.0.0.0") && !host.startsWith("::")) {
    return `${proto}://${host}`;
  }
  return FALLBACK_ORIGIN;
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

function isInternalApiRequest(req: NextRequest): boolean {
  if (!req.nextUrl.pathname.startsWith("/api/")) return false;
  const expectedSecret = process.env["DASHBOARD_INTERNAL_API_SECRET"];
  if (!expectedSecret) return false;
  return req.headers.get(INTERNAL_API_HEADER) === expectedSecret;
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    /\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map)$/.test(pathname)
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (isInternalApiRequest(req)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE));

  if (isPublicPath(pathname)) {
    if (pathname === "/login" && hasSession) {
      return NextResponse.redirect(new URL("/", getPublicOrigin(req)));
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (hasSession) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginURL = new URL("/login", getPublicOrigin(req));
  loginURL.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginURL);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
