import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const publicApiPrefixes = ["/api/public/", "/api/storefront/", "/api/account", "/api/auth/login"];

const passwordChangeApiPaths = ["/api/auth/change-password", "/api/auth/logout", "/api/auth/session"];

async function staffSessionClaims(token: string | undefined) {
  const sessionSecret = process.env.APP_SESSION_SECRET;
  if (!token || !sessionSecret) return null;
  try {
    const result = await jwtVerify(token, new TextEncoder().encode(sessionSecret));
    return result.payload.sub === "staff" ? { mustChangePassword: result.payload.mcp === true } : null;
  } catch { return null; }
}

async function validStaffSession(token: string | undefined) {
  return (await staffSessionClaims(token)) !== null;
}

/** Only /manage/** and non-public /api/** require a staff session; every other path (including unknown ones) is left to render normally, so a mistyped URL shows the real 404 page instead of a login wall. */
function requiresStaffAuth(path: string) {
  if (path.startsWith("/manage")) return true;
  if (path.startsWith("/api/")) {
    if (publicApiPrefixes.some((prefix) => path.startsWith(prefix))) return false;
    if (/^\/api\/events\/[^/]+\/attendees$/.test(path)) return false;
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if ((path === "/" || path === "/staff-login") && (await validStaffSession(request.cookies.get("ticketing_staff")?.value))) {
    const next = request.nextUrl.searchParams.get("next");
    return NextResponse.redirect(new URL(next && next.startsWith("/") ? next : "/manage/cms", request.url));
  }
  if (!requiresStaffAuth(path)) return NextResponse.next();
  const claims = await staffSessionClaims(request.cookies.get("ticketing_staff")?.value);
  if (claims?.mustChangePassword) {
    if (path.startsWith("/api/")) return passwordChangeApiPaths.includes(path) ? NextResponse.next() : NextResponse.json({ error: "Change your password to continue." }, { status: 403 });
    return NextResponse.redirect(new URL("/staff-login/change-password", request.url));
  }
  if (claims) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const loginUrl = new URL("/staff-login", request.url);
  loginUrl.searchParams.set("next", path);
  return NextResponse.redirect(loginUrl);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
