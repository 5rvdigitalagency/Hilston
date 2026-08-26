export type EventRecord = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  audiencePolicy: "general" | "adult_only" | "kids_only" | "kids_parent_mandatory";
  minAge?: number;
  maxAge?: number;
  venue: string;
  capacity: number;
  published: boolean;
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

const globalStore = globalThis as typeof globalThis & { __ticketingStore?: { events: EventRecord[]; attendees: AttendeeRecord[] } };

export const store = globalStore.__ticketingStore ?? { events: [], attendees: [] };
globalStore.__ticketingStore = store;

export function ensureDemoEvent() {
  if (store.events.length || process.env.DEMO_MODE === "false") return;
  store.events.push({
    id: "demo-event",
    title: "Demo event - not for sale",
    description: "A clearly labelled demonstration event for testing the public application and staff attendance views.",
    startsAt: "2026-12-01T10:00:00.000Z",
    audiencePolicy: "general",
    venue: "Demo venue",
    capacity: 50,
    published: true,
    attendeeCount: 0,
    childCount: 0,
    createdAt: new Date().toISOString(),
  });
}

ensureDemoEvent();

export function addEvent(input: Omit<EventRecord, "id" | "attendeeCount" | "childCount" | "createdAt">) {
  const event: EventRecord = { ...input, id: crypto.randomUUID(), attendeeCount: 0, childCount: 0, createdAt: new Date().toISOString() };
  store.events.push(event);
  return event;
}

export function addAttendee(input: Omit<AttendeeRecord, "id" | "createdAt">) {
  const attendee: AttendeeRecord = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  store.attendees.push(attendee);
  const event = store.events.find((item) => item.id === input.eventId);
  if (event) { event.attendeeCount += 1; event.childCount += input.childCount; }
  return attendee;
}
