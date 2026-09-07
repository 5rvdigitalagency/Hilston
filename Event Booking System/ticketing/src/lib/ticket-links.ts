import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.APP_SESSION_SECRET || "development-only-change-me");

/** Signed, unguessable link so a guest can open their tickets without an account. */
export async function createTicketLinkToken(bookingId: string) {
  return new SignJWT({ bookingId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("ticket-link")
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(secret);
}

export async function readTicketLinkToken(token: string) {
  try {
    const result = await jwtVerify(token, secret);
    if (result.payload.sub !== "ticket-link" || typeof result.payload.bookingId !== "string") return null;
    return result.payload.bookingId;
  } catch {
    return null;
  }
}
