import { demoSeedAllowed } from "./demo-environment";
import { allowPartialCheckIn, generateBookingReference, generateBookingTicketCode, resolveCheckInAdmission } from "./check-in-logic";

export type EventStatus = "draft" | "published" | "archived" | "cancelled" | "completed" | "sold_out";

export type EventRecord = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  category: string;
  categoryId?: string;
  audiencePolicy: "general" | "adult_only" | "kids_only" | "kids_parent_mandatory";
  minAge?: number;
  maxAge?: number;
  venue: string;
  capacity: number;
  pricePence?: number;
  childPricePence?: number;
  published: boolean;
  archived?: boolean;
  cancelled?: boolean;
  status?: EventStatus;
  attendeeCount: number;
  childCount: number;
  createdAt: string;
};

/** Status is always computed from lifecycle fields/schedule, never stored as a category value. */
export function computeDemoEventStatus(event: EventRecord): EventStatus {
  if (event.cancelled) return "cancelled";
  if (event.archived) return "archived";
  if (!event.published) return "draft";
  if (new Date(event.startsAt).getTime() < Date.now()) return "completed";
  const booked = event.attendeeCount + event.childCount;
  if (event.capacity > 0 && booked >= event.capacity) return "sold_out";
  return "published";
}

export type AttendeeRecord = {
  id: string;
  eventId: string;
  name: string;
  email: string;
  childCount: number;
  createdAt: string;
};

export type TicketRecord = { id: string; eventId: string; ticketCode: string; status: "issued" | "checked_in"; attendeeName: string; checkedInAt?: string; };

/** Phase 10.1: one booking = one ticket code + one QR code, with a guest total and a running checked-in count. */
export type BookingTicketRecord = {
  id: string;
  bookingId: string;
  ticketCode: string;
  totalGuests: number;
  checkedInCount: number;
};

export type EventSessionRecord = { id: string; eventId: string; startsAt: string; endsAt?: string; capacity: number };
export type TicketTypeRecord = { id: string; sessionId: string; name: string; pricePence: number; maxPerOrder: number };
export type SessionBookingRecord = {
  id: string;
  eventId: string;
  sessionId: string;
  name: string;
  email: string;
  phone: string;
  specialRequests: string;
  items: { ticketTypeId: string; quantity: number; unitPricePence: number }[];
  totalPence: number;
  bookingReference: string;
  createdAt: string;
};

type TicketingStore = {
  events: EventRecord[];
  attendees: AttendeeRecord[];
  tickets: TicketRecord[];
  sessions: EventSessionRecord[];
  ticketTypes: TicketTypeRecord[];
  sessionBookings: SessionBookingRecord[];
  bookingTickets: BookingTicketRecord[];
};

const globalStore = globalThis as typeof globalThis & { __ticketingStore?: TicketingStore };

export const store = globalStore.__ticketingStore ?? { events: [], attendees: [], tickets: [], sessions: [], ticketTypes: [], sessionBookings: [], bookingTickets: [] };
// Fast-refresh can reuse an older-shaped global across edits to this file, so backfill any missing arrays defensively.
store.sessions ??= [];
store.ticketTypes ??= [];
store.sessionBookings ??= [];
store.bookingTickets ??= [];
globalStore.__ticketingStore = store;

export function ensureDemoTickets() {
  if (!demoSeedAllowed()) return;
  if (store.tickets.some((ticket) => ticket.ticketCode === "DEMO-HILSTON-001")) return;
  store.tickets.push(
    { id: "demo-ticket", eventId: "demo-event", ticketCode: "DEMO-HILSTON-001", status: "issued", attendeeName: "Demo attendee" },
    { id: "demo-ticket-amelia", eventId: "demo-event", ticketCode: "DEMO-AMELIA-4821", status: "issued", attendeeName: "Amelia Bennett" },
    { id: "demo-ticket-owen", eventId: "demo-event", ticketCode: "DEMO-OWEN-7394", status: "issued", attendeeName: "Owen Hughes" },
    { id: "demo-ticket-used", eventId: "demo-event", ticketCode: "DEMO-USED-1001", status: "checked_in", attendeeName: "Morgan Davies" },
  );
}

export function ensureDemoEvent() {
  if (!demoSeedAllowed()) return;
  if (store.events.length || process.env.DEMO_MODE === "false") return;
  store.events.push({
    id: "demo-event",
    title: "Demo event - not for sale",
    description: "A clearly labelled demonstration event for testing the public application and staff attendance views.",
    startsAt: "2026-12-01T10:00:00.000Z",
    category: "Upcoming event",
    audiencePolicy: "general",
    venue: "Demo venue",
    capacity: 50,
    pricePence: 1500,
    childPricePence: 800,
    published: true,
    attendeeCount: 0,
    childCount: 0,
    createdAt: new Date().toISOString(),
  });
  ensureDemoTickets();
}

ensureDemoEvent();

type EventScheduleInput = {
  sessions?: { startsAt: string; endsAt?: string; capacity: number }[];
  ticketTypes?: { name: string; pricePence: number; maxPerOrder: number }[];
};

/** Mirrors db.ts's insertEvent/updateEvent: each session gets its own copy of every ticket type, and a single fallback session is created from the event's own date/capacity when none are supplied. */
function replaceEventSchedule(eventId: string, event: Pick<EventRecord, "startsAt" | "capacity">, input: EventScheduleInput) {
  const oldSessionIds = store.sessions.filter((session) => session.eventId === eventId).map((session) => session.id);
  store.ticketTypes = store.ticketTypes.filter((ticketType) => !oldSessionIds.includes(ticketType.sessionId));
  store.sessions = store.sessions.filter((session) => session.eventId !== eventId);

  const sessions = input.sessions?.length ? input.sessions : [{ startsAt: event.startsAt, capacity: event.capacity }];
  for (const session of sessions) {
    const sessionId = crypto.randomUUID();
    store.sessions.push({ id: sessionId, eventId, startsAt: session.startsAt, endsAt: session.endsAt, capacity: session.capacity });
    for (const ticketType of input.ticketTypes ?? []) {
      store.ticketTypes.push({ id: crypto.randomUUID(), sessionId, name: ticketType.name, pricePence: ticketType.pricePence, maxPerOrder: ticketType.maxPerOrder });
    }
  }
}

export function addEvent(input: Omit<EventRecord, "id" | "attendeeCount" | "childCount" | "createdAt"> & EventScheduleInput) {
  const { sessions, ticketTypes, ...eventFields } = input;
  const event: EventRecord = { ...eventFields, id: crypto.randomUUID(), attendeeCount: 0, childCount: 0, createdAt: new Date().toISOString() };
  store.events.push(event);
  replaceEventSchedule(event.id, event, { sessions, ticketTypes });
  return event;
}

export function updateEvent(id: string, input: Omit<EventRecord, "id" | "attendeeCount" | "childCount" | "createdAt"> & EventScheduleInput) {
  const event = store.events.find((item) => item.id === id);
  if (!event) return null;
  const { sessions, ticketTypes, ...eventFields } = input;
  Object.assign(event, eventFields);
  const hasBookings = store.sessionBookings.some((booking) => booking.eventId === id);
  if (!hasBookings) replaceEventSchedule(id, event, { sessions, ticketTypes });
  return event;
}

export function getEventScheduleForEdit(eventId: string) {
  const sessions = store.sessions.filter((session) => session.eventId === eventId);
  const flattened = new Map<string, { name: string; pricePence: number; maxPerOrder: number }>();
  for (const session of sessions) {
    for (const ticketType of store.ticketTypes.filter((item) => item.sessionId === session.id)) {
      const key = `${ticketType.name.toLowerCase()}|${ticketType.pricePence}|${ticketType.maxPerOrder}`;
      if (!flattened.has(key)) flattened.set(key, { name: ticketType.name, pricePence: ticketType.pricePence, maxPerOrder: ticketType.maxPerOrder });
    }
  }
  return {
    sessions: sessions.map((session) => ({ startsAt: session.startsAt, endsAt: session.endsAt ?? null, capacity: session.capacity })),
    ticketTypes: Array.from(flattened.values()),
  };
}

export type PublicSessionLike = { id: string; startsAt: string; endsAt: string | null; venue: string; capacity: number; remaining: number; ticketTypes: { id: string; name: string; pricePence: number; maxPerOrder: number }[] };

/** Demo-mode counterpart to db.ts's listEventSchedules — only future sessions, remaining computed from in-memory bookings. */
export function listStoreEventSchedules(eventIds: string[]): Record<string, PublicSessionLike[]> {
  const now = Date.now();
  const schedules: Record<string, PublicSessionLike[]> = {};
  for (const eventId of eventIds) {
    const event = store.events.find((item) => item.id === eventId);
    const sessions = store.sessions.filter((session) => session.eventId === eventId && new Date(session.endsAt ?? session.startsAt).getTime() > now);
    if (!sessions.length) continue;
    schedules[eventId] = sessions.map((session) => {
      const ticketTypes = store.ticketTypes.filter((item) => item.sessionId === session.id);
      const booked = store.sessionBookings.filter((booking) => booking.sessionId === session.id).reduce((sum, booking) => sum + booking.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
      return {
        id: session.id,
        startsAt: session.startsAt,
        endsAt: session.endsAt ?? null,
        venue: event?.venue ?? "",
        capacity: session.capacity,
        remaining: Math.max(0, session.capacity - booked),
        ticketTypes: ticketTypes.map((item) => ({ id: item.id, name: item.name, pricePence: item.pricePence, maxPerOrder: item.maxPerOrder })),
      };
    });
  }
  return schedules;
}

/** Demo-mode counterpart to db.ts's createSessionBooking — same validation rules, no real payment/email side effects. */
export function createStoreSessionBooking(input: { eventId: string; sessionId: string; items: { ticketTypeId: string; quantity: number }[]; name: string; email: string; phone: string; specialRequests: string }) {
  const event = store.events.find((item) => item.id === input.eventId);
  if (!event || !event.published) throw new Error("event_not_found");
  const session = store.sessions.find((item) => item.id === input.sessionId && item.eventId === input.eventId);
  if (!session || new Date(session.endsAt ?? session.startsAt).getTime() <= Date.now()) throw new Error("event_not_found");

  const totalQuantity = input.items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity <= 0) throw new Error("booking_empty");

  const alreadyBooked = store.sessionBookings.filter((booking) => booking.sessionId === session.id).reduce((sum, booking) => sum + booking.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  if (alreadyBooked + totalQuantity > session.capacity) throw new Error("event_full");

  const items: SessionBookingRecord["items"] = [];
  let totalPence = 0;
  for (const item of input.items) {
    const ticketType = store.ticketTypes.find((candidate) => candidate.id === item.ticketTypeId && candidate.sessionId === session.id);
    if (!ticketType) throw new Error("ticket_type_not_found");
    if (item.quantity > ticketType.maxPerOrder) throw new Error("ticket_limit_exceeded");
    items.push({ ticketTypeId: ticketType.id, quantity: item.quantity, unitPricePence: ticketType.pricePence });
    totalPence += ticketType.pricePence * item.quantity;
  }

  const bookingId = crypto.randomUUID();
  const ticketCode = generateBookingTicketCode();
  const booking: SessionBookingRecord = {
    id: bookingId,
    eventId: input.eventId,
    sessionId: input.sessionId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    specialRequests: input.specialRequests,
    items,
    totalPence,
    bookingReference: generateBookingReference(),
    createdAt: new Date().toISOString(),
  };
  store.sessionBookings.push(booking);
  store.bookingTickets.push({ id: crypto.randomUUID(), bookingId, ticketCode, totalGuests: totalQuantity, checkedInCount: 0 });
  event.attendeeCount += totalQuantity;

  return { bookingId: booking.id, attendeeId: booking.id, eventTitle: event.title, totalPence, ticketCode, totalGuests: totalQuantity };
}

/** Demo-mode counterpart to db.ts's getBookingForEmail. */
export function getStoreBookingForEmail(bookingId: string) {
  const booking = store.sessionBookings.find((item) => item.id === bookingId);
  if (!booking) throw new Error("booking_not_found");
  const event = store.events.find((item) => item.id === booking.eventId);
  const session = store.sessions.find((item) => item.id === booking.sessionId);
  const bookingTicket = store.bookingTickets.find((item) => item.bookingId === bookingId);
  return {
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    name: booking.name,
    email: booking.email,
    eventTitle: event?.title ?? "Event",
    startsAt: session?.startsAt ?? event?.startsAt ?? booking.createdAt,
    venue: event?.venue ?? "",
    ticketCode: bookingTicket?.ticketCode ?? null,
    totalGuests: bookingTicket?.totalGuests ?? 0,
  };
}

export function addAttendee(input: Omit<AttendeeRecord, "id" | "createdAt">) {
  const attendee: AttendeeRecord = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  store.attendees.push(attendee);
  const event = store.events.find((item) => item.id === input.eventId);
  if (event) { event.attendeeCount += 1; event.childCount += input.childCount; }
  store.tickets.push({ id: crypto.randomUUID(), eventId: input.eventId, ticketCode: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, status: "issued", attendeeName: input.name });
  return attendee;
}

export function addDemoTicket(input: { eventId: string; ticketCode: string; attendeeName: string }) {
  const ticket: TicketRecord = { id: crypto.randomUUID(), ...input, status: "issued" };
  store.tickets.push(ticket);
  return ticket;
}

export function checkInTicket(ticketCode: string) {
  const ticket = store.tickets.find((item) => item.ticketCode.toUpperCase() === ticketCode.trim().toUpperCase());
  if (!ticket) return { ok: false as const, error: "Ticket not found" };
  if (ticket.status === "checked_in") return { ok: false as const, error: "This ticket has already been checked in" };
  ticket.status = "checked_in";
  ticket.checkedInAt = new Date().toISOString();
  return { ok: true as const, ticket };
}

/** Demo-mode counterpart to db.ts's getBookingTicketState. */
export function getStoreBookingTicketState(bookingId: string) {
  const bookingTicket = store.bookingTickets.find((item) => item.bookingId === bookingId);
  if (!bookingTicket) return null;
  return { ticketCode: bookingTicket.ticketCode, totalGuests: bookingTicket.totalGuests, checkedInCount: bookingTicket.checkedInCount };
}

/** Demo-mode counterpart to db.ts's getBookingScanDetails. */
export function getStoreBookingScanDetails(ticketCode: string) {
  const bookingTicket = store.bookingTickets.find((item) => item.ticketCode.toUpperCase() === ticketCode.trim().toUpperCase());
  if (!bookingTicket) return null;
  const booking = store.sessionBookings.find((item) => item.id === bookingTicket.bookingId);
  if (!booking) return null;
  const event = store.events.find((item) => item.id === booking.eventId);
  const session = store.sessions.find((item) => item.id === booking.sessionId);
  const guestBreakdown = booking.items.map((item) => {
    const ticketType = store.ticketTypes.find((candidate) => candidate.id === item.ticketTypeId);
    return { name: ticketType?.name ?? "Ticket", quantity: item.quantity };
  });
  return {
    ticketCode: bookingTicket.ticketCode,
    bookingReference: booking.bookingReference,
    bookingStatus: "confirmed",
    eventTitle: event?.title ?? "Event",
    sessionId: session?.id ?? null,
    sessionStartsAt: session?.startsAt ?? null,
    sessionEndsAt: session?.endsAt ?? null,
    buyerName: booking.name,
    buyerEmail: booking.email,
    guestBreakdown,
    totalGuests: bookingTicket.totalGuests,
    checkedInCount: bookingTicket.checkedInCount,
    paid: false,
    testPayment: true,
    lastCheckedInAt: null,
    scannedBy: null,
  };
}

/** Demo-mode counterpart to db.ts's checkInBookingTicket. */
export function checkInBookingByCode(ticketCode: string, guests: number | undefined) {
  const bookingTicket = store.bookingTickets.find((item) => item.ticketCode.toUpperCase() === ticketCode.trim().toUpperCase());
  if (!bookingTicket) return { ok: false as const, error: "ticket_not_found" };
  const admission = resolveCheckInAdmission({ totalGuests: bookingTicket.totalGuests, checkedInCount: bookingTicket.checkedInCount }, guests, allowPartialCheckIn());
  if (!admission.ok) return { ok: false as const, error: admission.error };
  bookingTicket.checkedInCount += admission.guestsToAdmit;
  return { ok: true as const, guestsCheckedIn: admission.guestsToAdmit, totalGuests: bookingTicket.totalGuests, checkedInCount: bookingTicket.checkedInCount };
}
