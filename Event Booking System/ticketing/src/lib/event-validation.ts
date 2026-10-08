import { z } from "zod";

/** Editor wizard step indexes, shared so server errors can send the editor to the right step. */
export const EVENT_STEP = { basics: 0, schedule: 1, venue: 2, tickets: 3, rules: 4 } as const;

export type ValidationIssue = { field: string; step: number; message: string };

export const eventInputSchema = z.object({
  title: z.string().trim().max(120),
  description: z.string().trim().max(2000),
  startsAt: z.string().datetime(),
  category: z.string().trim().min(2).max(60).default("General event"),
  categoryId: z.string().uuid().optional(),
  venue: z.string().trim().max(120),
  capacity: z.number().int().max(100000),
  audiencePolicy: z.enum(["general", "adult_only", "kids_only", "kids_parent_mandatory"]),
  minAge: z.number().int().optional(),
  maxAge: z.number().int().optional(),
  sessions: z.array(z.object({ startsAt: z.string().datetime(), endsAt: z.string().datetime().optional(), capacity: z.number().int() })).optional(),
  ticketTypes: z.array(z.object({ name: z.string().trim().max(80), pricePence: z.number().int(), maxPerOrder: z.number().int() })).optional(),
  published: z.boolean().default(false),
});

export type EventInput = z.infer<typeof eventInputSchema>;

export function stepForField(field: string): number {
  const root = field.split(".")[0];
  if (root === "title" || root === "description" || root === "category" || root === "categoryId") return EVENT_STEP.basics;
  if (root === "sessions" || root === "startsAt" || root === "capacity") return EVENT_STEP.schedule;
  if (root === "venue") return EVENT_STEP.venue;
  if (root === "ticketTypes") return EVENT_STEP.tickets;
  return EVENT_STEP.rules;
}

function issue(field: string, message: string): ValidationIssue {
  return { field, step: stepForField(field), message };
}

/** Business rules shared by the editor ("Next" and save) and the events API. */
export function eventIssues(event: EventInput, options: { requireFuture: boolean }): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const now = Date.now() - 60_000;
  if (event.title.length < 2) issues.push(issue("title", "Add an event name of at least 2 characters."));
  if (event.description.length < 2) issues.push(issue("description", "Describe the event in at least 2 characters."));
  if (event.venue.length < 2) issues.push(issue("venue", "Add a venue name of at least 2 characters."));

  const sessions = event.sessions ?? [];
  if (sessions.length === 0) issues.push(issue("sessions", "Add at least one session."));
  sessions.forEach((session, index) => {
    const label = sessions.length > 1 ? `Session ${index + 1}` : "The session";
    const start = new Date(session.startsAt).getTime();
    if (options.requireFuture && start <= now) issues.push(issue(`sessions.${index}.startsAt`, `${label} must start in the future.`));
    if (session.endsAt && new Date(session.endsAt).getTime() <= start) issues.push(issue(`sessions.${index}.endsAt`, `${label} must end after it starts.`));
    if (session.capacity < 1) issues.push(issue(`sessions.${index}.capacity`, "Capacity must be at least 1."));
    if (session.capacity > 100000) issues.push(issue(`sessions.${index}.capacity`, "Capacity can be at most 100,000."));
  });

  const tickets = event.ticketTypes ?? [];
  if (event.published && tickets.length === 0) issues.push(issue("ticketTypes", "Add at least one ticket type before publishing."));
  tickets.forEach((ticket, index) => {
    if (ticket.name.length < 1) issues.push(issue(`ticketTypes.${index}.name`, "Give this ticket type a name."));
    if (ticket.pricePence < 0) issues.push(issue(`ticketTypes.${index}.pricePence`, "Price can't be negative."));
    if (ticket.maxPerOrder < 1) issues.push(issue(`ticketTypes.${index}.maxPerOrder`, "Allow at least 1 ticket per booking."));
    if (ticket.maxPerOrder > 1000) issues.push(issue(`ticketTypes.${index}.maxPerOrder`, "Allow at most 1,000 tickets per booking."));
  });

  for (const key of ["minAge", "maxAge"] as const) {
    const value = event[key];
    if (value !== undefined && (value < 0 || value > 120)) issues.push(issue(key, "Ages must be between 0 and 120."));
  }
  if (event.minAge !== undefined && event.maxAge !== undefined && event.minAge > event.maxAge) issues.push(issue("maxAge", "Maximum age must be the same as or higher than the minimum age."));
  return issues;
}

/** Converts zod type errors into the same issue shape the editor understands. */
export function zodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((item) => {
    const field = item.path.join(".") || "event";
    return issue(field, item.message);
  });
}
