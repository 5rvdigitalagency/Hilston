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
  published: boolean;
  archived?: boolean;
  attendeeCount: number;
  childCount: number;
  createdAt: string;
};

export type AttendeeRecord = {
  id: string;
  eventId: string;
  name: string;
  email: string;
  childCount: number;
  createdAt: string;
};

export type TicketRecord = { id: string; eventId: string; ticketCode: string; status: "issued" | "checked_in"; attendeeName: string; };

const globalStore = globalThis as typeof globalThis & { __ticketingStore?: { events: EventRecord[]; attendees: AttendeeRecord[]; tickets: TicketRecord[] } };

export const store = globalStore.__ticketingStore ?? { events: [], attendees: [], tickets: [] };
globalStore.__ticketingStore = store;

export function ensureDemoTickets() {
  if (store.tickets.some((ticket) => ticket.ticketCode === "DEMO-HILSTON-001")) return;
  store.tickets.push(
    { id: "demo-ticket", eventId: "demo-event", ticketCode: "DEMO-HILSTON-001", status: "issued", attendeeName: "Demo attendee" },
    { id: "demo-ticket-amelia", eventId: "demo-event", ticketCode: "DEMO-AMELIA-4821", status: "issued", attendeeName: "Amelia Bennett" },
    { id: "demo-ticket-owen", eventId: "demo-event", ticketCode: "DEMO-OWEN-7394", status: "issued", attendeeName: "Owen Hughes" },
    { id: "demo-ticket-used", eventId: "demo-event", ticketCode: "DEMO-USED-1001", status: "checked_in", attendeeName: "Morgan Davies" },
  );
}

export function ensureDemoEvent() {
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
    published: true,
    attendeeCount: 0,
    childCount: 0,
    createdAt: new Date().toISOString(),
  });
  ensureDemoTickets();
}

ensureDemoEvent();

export function addEvent(input: Omit<EventRecord, "id" | "attendeeCount" | "childCount" | "createdAt">) {
  const event: EventRecord = { ...input, id: crypto.randomUUID(), attendeeCount: 0, childCount: 0, createdAt: new Date().toISOString() };
  store.events.push(event);
  return event;
}

export function updateEvent(id: string, input: Omit<EventRecord, "id" | "attendeeCount" | "childCount" | "createdAt">) {
  const event = store.events.find((item) => item.id === id);
  if (!event) return null;
  Object.assign(event, input);
  return event;
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
  return { ok: true as const, ticket };
}
