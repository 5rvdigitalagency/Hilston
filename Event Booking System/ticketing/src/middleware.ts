import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const publicPaths = ["/", "/account", "/events", "/staff-login", "/api/auth/login"];

async function validStaffSession(token: string | undefined) {
  const sessionSecret = process.env.APP_SESSION_SECRET;
  if (!token || !sessionSecret) return false;
  try {
    const result = await jwtVerify(token, new TextEncoder().encode(sessionSecret));
    return result.payload.sub === "staff";
  } catch { return false; }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (publicPaths.includes(path) || path.startsWith("/api/public/") || path.startsWith("/tickets/") || path.startsWith("/api/account") || /^\/api\/events\/[^/]+\/attendees$/.test(path) || path.startsWith("/_next/") || path.startsWith("/brand/") || path.startsWith("/fonts/") || path === "/favicon.ico") return NextResponse.next();
  if (await validStaffSession(request.cookies.get("ticketing_staff")?.value)) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Staff authentication required" }, { status: 401 });
  const loginUrl = new URL("/staff-login", request.url);
  loginUrl.searchParams.set("next", path);
  return NextResponse.redirect(loginUrl);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
