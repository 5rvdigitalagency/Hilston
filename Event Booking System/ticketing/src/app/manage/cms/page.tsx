"use client";

import Link from "next/link";
import { Archive, CalendarDots, CheckCircle, Clock, CurrencyGbp, Plus, Ticket, X } from "@phosphor-icons/react";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import StaffShell from "../staff-shell";
import { EVENT_STEP, eventIssues, type EventInput, type ValidationIssue } from "@/lib/event-validation";
import { formatGBP } from "@/lib/booking-status";

type EventRecord = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  category: string;
  categoryId?: string;
  venue: string;
  capacity: number;
  audiencePolicy: string;
  minAge?: number;
  maxAge?: number;
  published: boolean;
  archived?: boolean;
  cancelled?: boolean;
  status?: "draft" | "published" | "archived" | "cancelled" | "completed" | "sold_out";
  attendeeCount?: number;
  childCount?: number;
};

type BookingSummary = { bookingId: string; eventId: string; paid: boolean; testPayment?: boolean; status: string; totalGuests: number; totalPence: number };
type SessionRow = { date: string; startTime: string; endTime: string; capacity: string };
type TicketRow = { name: string; price: string; maxPerOrder: string };

const AUDIENCE_OPTIONS = [
  { value: "general", label: "Everyone" },
  { value: "adult_only", label: "Adults only" },
  { value: "kids_only", label: "Children only" },
  { value: "kids_parent_mandatory", label: "Children with parent or guardian" },
];
const EVENT_WIZARD_STEPS = ["Basic Information", "Schedule", "Venue", "Ticket Types", "Booking Rules", "Media & Review"];

const EMPTY_FORM = {
  title: "",
  description: "",
  venue: "Hilston Park",
  categoryId: "",
  audiencePolicy: "general",
  minAge: "",
  maxAge: "",
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

// Inputs use the browser's local time, so saved sessions must be shown in local time too.
function localDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localTimeInput(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function sessionStartDate(session: SessionRow) {
  if (session.date === "" || session.startTime === "") return null;
  const start = new Date(`${session.date}T${session.startTime}:00`);
  return Number.isNaN(start.getTime()) ? null : start;
}

function errorId(field: string) {
  return `error-${field.replace(/[^a-zA-Z0-9]/g, "-")}`;
}

function audienceLabel(value: string) {
  return AUDIENCE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function computeStatusValue(event: Pick<EventRecord, "status" | "archived" | "cancelled" | "published">) {
  return event.status ?? (event.cancelled ? "cancelled" : event.archived ? "archived" : event.published ? "published" : "draft");
}

function formatStatusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date to confirm";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function initialEditorOpen() {
  return typeof window !== "undefined" && window.location.hash === "#event-editor";
}

function initialPendingEdit() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("edit");
  return id ? { id, step: Number(params.get("step")) || 0 } : null;
}

export default function CmsPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [editorOpen, setEditorOpen] = useState(initialEditorOpen);
  const [wizardStep, setWizardStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(() => new Set([0]));
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [categoriesError, setCategoriesError] = useState(false);
  const [eventsError, setEventsError] = useState(false);
  const [bookingsError, setBookingsError] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [uploadProgress, setUploadProgress] = useState("");
  const [mediaMaxMb, setMediaMaxMb] = useState(50);
  const [featuredMedia, setFeaturedMedia] = useState<File[]>([]);
  const [galleryMedia, setGalleryMedia] = useState<File[]>([]);
  const [videoMedia, setVideoMedia] = useState<File[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([{ date: "", startTime: "10:00", endTime: "", capacity: "50" }]);
  const [ticketTypes, setTicketTypes] = useState<TicketRow[]>([{ name: "Adult", price: "", maxPerOrder: "10" }]);
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [status, setStatus] = useState<{ tone: "success" | "error" | "warning"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "archived" | "cancelled" | "completed" | "sold_out">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [baseline, setBaseline] = useState<string | null>(null);

  function setWizardStepAndMark(step: number) {
    setVisitedSteps((current) => current.has(step) ? current : new Set(current).add(step));
    setWizardStep(step);
  }

  const loadEvents = useCallback(() => {
    setLoadingEvents(true);
    return fetch("/api/events", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("events_load_failed"))))
      .then((result) => { const nextEvents = Array.isArray(result.events) ? result.events as EventRecord[] : []; setEvents(nextEvents); setEventsError(false); return nextEvents; })
      .catch(() => { setEvents([]); setEventsError(true); return []; })
      .finally(() => setLoadingEvents(false));
  }, []);

  const loadBookings = useCallback(() => {
    return fetch("/api/manage/bookings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("bookings_load_failed"))))
      .then((result) => { setBookings(Array.isArray(result.bookings) ? result.bookings : []); setBookingsError(false); })
      .catch(() => { setBookings([]); setBookingsError(true); });
  }, []);

  const loadCategories = useCallback(() => {
    return fetch("/api/event-categories", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("categories_load_failed"))))
      .then((result) => { setCategories(Array.isArray(result.categories) ? result.categories : []); setCategoriesError(false); })
      .catch(() => setCategoriesError(true));
  }, []);

  const categoryOptions = useMemo(() => {
    if (form.categoryId && !categories.some((category) => category.id === form.categoryId)) {
      const label = editingEvent?.categoryId === form.categoryId ? editingEvent.category : "Unknown category";
      return [...categories, { id: form.categoryId, name: `${label} (unavailable)` }];
    }
    return categories;
  }, [categories, form.categoryId, editingEvent]);

  const counts = useMemo(() => ({
    published: events.filter((event) => computeStatusValue(event) === "published").length,
    drafts: events.filter((event) => computeStatusValue(event) === "draft").length,
    archived: events.filter((event) => computeStatusValue(event) === "archived").length,
    bookings: bookings.length,
    ticketsSold: bookings.filter((booking) => booking.paid).reduce((total, booking) => total + booking.totalGuests, 0),
    revenuePence: bookings.filter((booking) => booking.paid).reduce((total, booking) => total + booking.totalPence, 0),
  }), [events, bookings]);

  const bookingTotalsByEvent = useMemo(() => bookings.reduce((totals, booking) => {
    const current = totals.get(booking.eventId) || { tickets: 0, testTickets: 0, revenuePence: 0, activeTickets: 0, bookings: 0 };
    current.bookings += 1;
    if (booking.status !== "cancelled") current.activeTickets += booking.totalGuests;
    if (booking.paid) {
      current.tickets += booking.totalGuests;
      current.revenuePence += booking.totalPence;
    } else if (booking.testPayment && booking.status !== "cancelled") {
      current.testTickets += booking.totalGuests;
    }
    totals.set(booking.eventId, current);
    return totals;
  }, new Map<string, { tickets: number; testTickets: number; revenuePence: number; activeTickets: number; bookings: number }>()), [bookings]);

  const venues = useMemo(() => Array.from(new Set(events.map((event) => event.venue).filter(Boolean))).sort(), [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const computedStatus = computeStatusValue(event);
      const matchesSearch = !searchTerm || `${event.title} ${event.venue} ${event.category}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || computedStatus === statusFilter;
      const matchesCategory = categoryFilter === "all" || event.categoryId === categoryFilter;
      const matchesVenue = venueFilter === "all" || event.venue === venueFilter;
      return matchesSearch && matchesStatus && matchesCategory && matchesVenue;
    });
  }, [events, searchTerm, statusFilter, categoryFilter, venueFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedEvents = filteredEvents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function resetFilters() {
    setSearchTerm("");
    setCategoryFilter("all");
    setVenueFilter("all");
    setStatusFilter("all");
    setPage(1);
    setSelectedIds(new Set());
  }

  function resetListSelection() {
    setPage(1);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((current) => {
      const pageIds = paginatedEvents.map((event) => event.id);
      const allSelected = pageIds.every((id) => current.has(id));
      const next = new Set(current);
      pageIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function audienceBadge(event: EventRecord) {
    if (event.audiencePolicy === "adult_only") return "Adults only";
    if (event.audiencePolicy === "kids_only") return "Children only";
    if (event.audiencePolicy === "kids_parent_mandatory") return "Guardian required";
    if (event.minAge) return `${event.minAge}+`;
    return null;
  }

  function clearFieldError(prefix: string) {
    setFieldErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== prefix && key.startsWith(`${prefix}.`) === false)));
  }

  function applyIssues(issues: ValidationIssue[]) {
    setFieldErrors(Object.fromEntries(issues.map((item) => [item.field, item.message])));
  }

  function fieldError(field: string) {
    const message = fieldErrors[field];
    return message ? <small className="field-hint field-hint-error" id={errorId(field)}>{message}</small> : null;
  }

  function invalidProps(field: string) {
    return fieldErrors[field] ? { "aria-invalid": true as const, "aria-describedby": errorId(field) } : {};
  }

  function update(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    clearFieldError(field);
    setStatus(null);
  }

  function updateSession(index: number, field: keyof SessionRow, value: string) {
    setSessions((current) => current.map((session, sessionIndex) => sessionIndex === index ? { ...session, [field]: value } : session));
    clearFieldError(`sessions.${index}`);
    setStatus(null);
  }

  function updateTicket(index: number, field: keyof TicketRow, value: string) {
    setTicketTypes((current) => current.map((ticket, ticketIndex) => ticketIndex === index ? { ...ticket, [field]: value } : ticket));
    clearFieldError(`ticketTypes.${index}`);
    setStatus(null);
  }

  function upload(event: ChangeEvent<HTMLInputElement>, category: "featured" | "gallery" | "video") {
    const chosen = Array.from(event.target.files || []);
    const oversized = chosen.filter((file) => file.size > mediaMaxMb * 1024 * 1024);
    if (oversized.length) {
      setStatus({ tone: "error", message: `${oversized.map((file) => file.name).join(", ")} is larger than the ${mediaMaxMb} MB upload limit. Compress the file or choose a smaller one.` });
      event.target.value = "";
      if (category === "featured") setFeaturedMedia([]);
      if (category === "gallery") setGalleryMedia([]);
      if (category === "video") setVideoMedia([]);
      return;
    }
    setStatus(null);
    if (category === "featured") setFeaturedMedia(chosen.slice(0, 1));
    if (category === "gallery") setGalleryMedia(chosen);
    if (category === "video") setVideoMedia(chosen);
  }

  /** Uploads straight to storage so large videos bypass the serverless request size limit. */
  async function uploadMedia(eventId: string, files: File[]) {
    for (const [index, file] of files.entries()) {
      setUploadProgress(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
      const prepared = await fetch(`/api/events/${eventId}/media/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      });
      const preparedResult = await prepared.json().catch(() => ({}));
      if (!prepared.ok) throw new Error(preparedResult.error || "The upload could not be prepared.");

      const stored = await fetch(preparedResult.uploadUrl, { method: "PUT", headers: file.type ? { "Content-Type": file.type } : undefined, body: file });
      if (!stored.ok) throw new Error(`Storage rejected ${file.name}. It may exceed the storage file size limit.`);

      const registered = await fetch(`/api/events/${eventId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey: preparedResult.storageKey, contentType: file.type }),
      });
      if (!registered.ok) {
        const registerResult = await registered.json().catch(() => ({}));
        throw new Error(registerResult.error || `${file.name} uploaded but could not be attached.`);
      }
    }
    setUploadProgress("");
  }

  function soldTicketNote(eventIds: string[]) {
    const held = eventIds.reduce((total, id) => total + (bookingTotalsByEvent.get(id)?.activeTickets ?? 0), 0);
    return held > 0 ? `\n\n${held} ${held === 1 ? "ticket has" : "tickets have"} been sold. Those customers keep their tickets and are not notified.` : "";
  }

  async function setArchived(event: EventRecord, archived: boolean, confirmed = false) {
    if (archived && confirmed === false && window.confirm(`Archive "${event.title}"? It will be removed from the public storefront but all bookings and tickets are kept.${soldTicketNote([event.id])}`) === false) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/events/${event.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setStatus({ tone: "error", message: result.error || "The event could not be updated." });
      setStatus({ tone: "success", message: archived ? `"${event.title}" is archived and no longer on the storefront.` : `"${event.title}" has been restored.` });
      loadEvents();
    } catch {
      setStatus({ tone: "error", message: "Network problem while updating. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(event: EventRecord) {
    const bookingCount = bookingTotalsByEvent.get(event.id)?.bookings ?? 0;
    if (bookingCount > 0) {
      if (window.confirm(`"${event.title}" has ${bookingCount} ${bookingCount === 1 ? "booking" : "bookings"}, so it can't be deleted without losing guest records.\n\nArchive it instead? It will leave the storefront and keep every booking and ticket.`)) await setArchived(event, true, true);
      return;
    }
    if (window.confirm(`Permanently delete "${event.title}"? This cannot be undone.`) === false) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setStatus({ tone: "error", message: result.error || "The event could not be deleted." });
      setStatus({ tone: "success", message: `"${event.title}" has been deleted.` });
      loadEvents();
    } catch {
      setStatus({ tone: "error", message: "Network problem while deleting. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function bulkSetArchived(archived: boolean) {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (archived && window.confirm(`Archive ${ids.length} selected event(s)? They will be removed from the public storefront but all bookings and tickets are kept.${soldTicketNote(ids)}`) === false) return;
    setSaving(true);
    setStatus(null);
    try {
      await Promise.all(ids.map((id) => fetch(`/api/events/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived }) })));
      setStatus({ tone: "success", message: `${ids.length} event(s) ${archived ? "archived" : "restored"}.` });
      setSelectedIds(new Set());
      loadEvents();
    } catch {
      setStatus({ tone: "error", message: "Network problem while updating. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const withBookings = ids.filter((id) => (bookingTotalsByEvent.get(id)?.bookings ?? 0) > 0);
    const deletable = ids.filter((id) => withBookings.includes(id) === false);
    if (deletable.length === 0) {
      setStatus({ tone: "error", message: "The selected events all have bookings, so they can't be deleted. Archive them instead." });
      return;
    }
    const skippedNote = withBookings.length ? `\n\n${withBookings.length} selected event(s) have bookings and will be skipped. Archive those instead.` : "";
    if (window.confirm(`Permanently delete ${deletable.length} event(s)? This cannot be undone.${skippedNote}`) === false) return;
    setSaving(true);
    setStatus(null);
    try {
      const results = await Promise.all(deletable.map((id) => fetch(`/api/events/${id}`, { method: "DELETE" }).then((response) => response.ok).catch(() => false)));
      const deleted = results.filter(Boolean).length;
      const failed = deletable.length - deleted;
      const parts = [`${deleted} event(s) deleted.`];
      if (withBookings.length) parts.push(`${withBookings.length} skipped because they have bookings.`);
      if (failed) parts.push(`${failed} could not be deleted.`);
      setStatus({ tone: failed ? "error" : "success", message: parts.join(" ") });
      setSelectedIds(new Set());
      loadEvents();
    } finally {
      setSaving(false);
    }
  }

  async function startEditing(event: EventRecord) {
    const startsAt = new Date(event.startsAt);
    const nextForm = {
      title: event.title,
      description: event.description,
      venue: event.venue,
      categoryId: event.categoryId || "",
      audiencePolicy: event.audiencePolicy,
      minAge: event.minAge === undefined || event.minAge === null ? "" : String(event.minAge),
      maxAge: event.maxAge === undefined || event.maxAge === null ? "" : String(event.maxAge),
    };
    setEditingEvent(event);
    setEditorOpen(true);
    setWizardStep(0);
    setForm(nextForm);
    const fallbackSession = { date: localDateInput(startsAt), startTime: localTimeInput(startsAt), endTime: "", capacity: String(event.capacity || 1) };
    const fallbackTicket = { name: "Adult", price: "", maxPerOrder: "10" };
    let nextSessions = [fallbackSession];
    let nextTicketTypes = [fallbackTicket];
    setSessions([fallbackSession]);
    setTicketTypes([fallbackTicket]);
    setFieldErrors({});
    setVisitedSteps(new Set(EVENT_WIZARD_STEPS.map((_, index) => index)));
    setStatus(null);
    document.getElementById("event-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
      const response = await fetch(`/api/events/${event.id}`, { cache: "no-store" });
      const schedule = response.ok ? await response.json() : null;
      const savedSessions = Array.isArray(schedule?.sessions) ? schedule.sessions : [];
      const savedTicketTypes = Array.isArray(schedule?.ticketTypes) ? schedule.ticketTypes : [];
      if (savedSessions.length) {
        nextSessions = savedSessions.map((session: { startsAt: string; endsAt: string | null; capacity: number }) => {
          const sessionStart = new Date(session.startsAt);
          return {
            date: localDateInput(sessionStart),
            startTime: localTimeInput(sessionStart),
            endTime: session.endsAt ? localTimeInput(new Date(session.endsAt)) : "",
            capacity: String(session.capacity),
          };
        });
        setSessions(nextSessions);
      }
      if (savedTicketTypes.length) {
        nextTicketTypes = savedTicketTypes.map((ticket: { name: string; pricePence: number; maxPerOrder: number }) => ({
          name: ticket.name,
          price: (ticket.pricePence / 100).toFixed(2),
          maxPerOrder: String(ticket.maxPerOrder),
        }));
        setTicketTypes(nextTicketTypes);
      }
    } catch {
      // Keep the single-session fallback already populated above.
    }
    setBaseline(JSON.stringify({ form: nextForm, sessions: nextSessions, ticketTypes: nextTicketTypes, media: 0 }));
  }

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        if (!result.authenticated) return setAccess("denied");
        setAccess("allowed");
        if (result.mediaMaxMb) setMediaMaxMb(result.mediaMaxMb);
        loadEvents().then((loadedEvents) => {
          const edit = initialPendingEdit();
          const match = edit && loadedEvents.find((event) => event.id === edit.id);
          if (match && edit) startEditing(match).then(() => setWizardStepAndMark(edit.step));
        });
        loadBookings();
        loadCategories();
        return undefined;
      })
      .catch(() => setAccess("denied"));
  }, [loadEvents, loadBookings, loadCategories]);

  async function setPublication(event: EventRecord, published: boolean) {
    const prompt = published
      ? `Publish "${event.title}" to the public catalogue?${soldTicketNote([event.id])}`
      : `Take "${event.title}" out of the public catalogue? It will remain available as a draft.${soldTicketNote([event.id])}`;
    if (window.confirm(prompt) === false) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus({ tone: "error", message: result.error || "The event could not be updated." });
        return;
      }
      setStatus({ tone: "success", message: published ? `"${event.title}" is now published.` : `"${event.title}" has been taken down and saved as a draft.` });
      loadEvents();
    } catch {
      setStatus({ tone: "error", message: "Network problem while updating. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function buildEventDraft(publish: boolean): { payload: EventInput; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    const scheduled: NonNullable<EventInput["sessions"]> = [];
    sessions.forEach((session, index) => {
      const start = sessionStartDate(session);
      if (start === null) issues.push({ field: `sessions.${index}.startsAt`, step: EVENT_STEP.schedule, message: "Pick a date and start time." });
      if (session.capacity === "" || Number.isNaN(Number(session.capacity))) issues.push({ field: `sessions.${index}.capacity`, step: EVENT_STEP.schedule, message: "Enter a capacity." });
      let endsAt: string | undefined;
      if (session.endTime && start) {
        const end = new Date(`${session.date}T${session.endTime}:00`);
        if (Number.isNaN(end.getTime())) issues.push({ field: `sessions.${index}.endsAt`, step: EVENT_STEP.schedule, message: "Enter a valid end time." });
        else endsAt = end.toISOString();
      }
      if (start) scheduled.push({ startsAt: start.toISOString(), endsAt, capacity: Math.trunc(Number(session.capacity) || 0) });
    });
    const tickets = ticketTypes.map((ticket, index) => {
      if (ticket.price === "" || Number.isNaN(Number(ticket.price))) issues.push({ field: `ticketTypes.${index}.pricePence`, step: EVENT_STEP.tickets, message: "Enter a price (use 0 for free)." });
      if (ticket.maxPerOrder === "" || Number.isNaN(Number(ticket.maxPerOrder))) issues.push({ field: `ticketTypes.${index}.maxPerOrder`, step: EVENT_STEP.tickets, message: "Enter how many can be bought per booking." });
      return { name: ticket.name.trim(), pricePence: Math.round(Number(ticket.price || 0) * 100), maxPerOrder: Math.trunc(Number(ticket.maxPerOrder || 0)) };
    });
    const earliest = scheduled.map((session) => session.startsAt).sort()[0];
    const payload: EventInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      startsAt: earliest ?? new Date().toISOString(),
      categoryId: form.categoryId || undefined,
      category: categories.find((category) => category.id === form.categoryId)?.name || editingEvent?.category || "General event",
      venue: form.venue.trim(),
      capacity: Math.min(100000, Math.max(1, scheduled.reduce((total, session) => total + session.capacity, 0))),
      audiencePolicy: form.audiencePolicy as EventInput["audiencePolicy"],
      minAge: form.minAge === "" ? undefined : Math.trunc(Number(form.minAge)),
      maxAge: form.maxAge === "" ? undefined : Math.trunc(Number(form.maxAge)),
      published: publish,
      sessions: scheduled,
      ticketTypes: tickets,
    };
    // Matches the server: unchanged past dates stay editable, a moved first session must be in the future.
    const requireFuture = editingEvent === null || earliest === undefined || new Date(earliest).getTime() !== new Date(editingEvent.startsAt).getTime();
    const combined = [...issues, ...eventIssues(payload, { requireFuture })];
    const seen = new Set<string>();
    return { payload, issues: combined.filter((item) => (seen.has(item.field) ? false : (seen.add(item.field), true))) };
  }

  async function save(publish: boolean) {
    const built = buildEventDraft(publish);
    if (built.issues.length) {
      applyIssues(built.issues);
      setWizardStepAndMark(built.issues[0].step);
      setStatus(null);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    setStatus(null);
    const media = [...featuredMedia, ...galleryMedia, ...videoMedia];
    try {
      const response = await fetch("/api/events", {
        method: editingEvent ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(editingEvent ? { id: editingEvent.id } : {}), ...built.payload }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 400 && Array.isArray(result.issues) && result.issues.length) {
          applyIssues(result.issues);
          setWizardStepAndMark(typeof result.step === "number" ? result.step : 0);
          return;
        }
        setStatus({ tone: "error", message: result.error || "The event could not be saved." });
        return;
      }
      if (media.length) {
        try {
          await uploadMedia(result.event.id, media);
        } catch (error) {
          setUploadProgress("");
          setStatus({ tone: "error", message: `Event saved, but media was not uploaded: ${error instanceof Error ? error.message : "please try again."}` });
          setFeaturedMedia([]);
          setGalleryMedia([]);
          setVideoMedia([]);
          await loadEvents();
          return;
        }
      }
      setStatus({
        tone: "success",
        message: publish ? (editingEvent ? "Event changes saved and published." : "Event published. It will appear on the storefront within a minute.") : (editingEvent ? "Event changes saved as a draft." : "Draft saved. Publish it when you are ready."),
      });
      setForm(EMPTY_FORM);
      setSessions([{ date: "", startTime: "10:00", endTime: "", capacity: "50" }]);
      setTicketTypes([{ name: "Adult", price: "", maxPerOrder: "10" }]);
      setFieldErrors({});
      setVisitedSteps(new Set([0]));
      setBaseline(null);
      setEditingEvent(null);
      setEditorOpen(false);
      setWizardStep(0);
      setFeaturedMedia([]);
      setGalleryMedia([]);
      setVideoMedia([]);
      loadEvents();
    } catch {
      setStatus({ tone: "error", message: "Network problem while saving. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    save(true);
  }

  function nextWizardStep() {
    const stepIssues = buildEventDraft(false).issues.filter((item) => item.step === wizardStep);
    setStatus(null);
    if (stepIssues.length) {
      applyIssues(stepIssues);
      return;
    }
    setFieldErrors({});
    setWizardStepAndMark(Math.min(EVENT_WIZARD_STEPS.length - 1, wizardStep + 1));
  }

  const draftSnapshot = JSON.stringify({ form, sessions, ticketTypes, media: featuredMedia.length + galleryMedia.length + videoMedia.length });
  const isDirty = editorOpen && baseline !== null && baseline !== draftSnapshot;
  useEffect(() => {
    if (isDirty === false) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    // In-app links bypass beforeunload, so internal navigation is confirmed here too.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (link === null || link.target === "_blank" || link.origin !== window.location.origin) return;
      if (window.confirm("You have unsaved changes to this event. Leave without saving?") === false) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", onBeforeUnload); document.removeEventListener("click", onClick, true); };
  }, [isDirty]);

  function confirmDiscard() {
    return isDirty === false || window.confirm("You have unsaved changes to this event. Discard them?");
  }

  const draftIssues = editorOpen ? buildEventDraft(false).issues : [];
  const firstSession = sessions.map(sessionStartDate).filter((start): start is Date => start !== null).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const totalCapacity = sessions.reduce((total, session) => total + (Number(session.capacity) || 0), 0);
  const errorCount = Object.keys(fieldErrors).length;

  // A step is only ticked once it has been visited and its fields pass validation.
  function isStepComplete(index: number) {
    if (index > EVENT_STEP.rules || visitedSteps.has(index) === false) return false;
    return draftIssues.every((item) => item.step !== index);
  }

  if (access === "checking") {
    return (
      <main className="page-shell">
        <section className="content-section">
          <p className="eyebrow">Staff CMS</p>
          <h1>Checking access.</h1>
        </section>
      </main>
    );
  }

  if (access === "denied") {
    return (
      <main className="page-shell">
        <header className="subbar">
          <Link className="brand" href="/"><img className="brand-logo" src="/brand/hilston-park-logo.webp" alt="Hilston Park Tickets" /></Link>
          <span className="status-pill">Staff only</span>
        </header>
        <section className="content-section auth-layout">
          <p className="eyebrow">Restricted area</p>
          <h1>Staff access required.</h1>
          <p className="lead-copy">Sign in through the staff console before opening the event management workspace.</p>
          <Link className="primary-button" href="/manage">Go to staff login <span aria-hidden="true">→</span></Link>
        </section>
      </main>
    );
  }

  return (
    <StaffShell active="events" title="Events and bookings">
      <section className="events-page-heading">
        <div>
          <p className="eyebrow">Event management</p>
          <h1>Events</h1>
          <p>Manage your events. Create, edit, publish, and view performance.</p>
        </div>
        {!editorOpen && <button className="primary-button" type="button" onClick={() => { const nextSessions = [{ date: "", startTime: "10:00", endTime: "", capacity: "50" }]; const nextTicketTypes = [{ name: "Adult", price: "", maxPerOrder: "10" }]; setEditingEvent(null); setForm(EMPTY_FORM); setSessions(nextSessions); setTicketTypes(nextTicketTypes); setBaseline(JSON.stringify({ form: EMPTY_FORM, sessions: nextSessions, ticketTypes: nextTicketTypes, media: 0 })); setFieldErrors({}); setVisitedSteps(new Set([0])); setWizardStep(0); setEditorOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Plus aria-hidden="true" size={17} /> Create event</button>}
      </section>

      <section className="cms-content events-page-content">
        {(eventsError || bookingsError) && !editorOpen && (
          <p className="form-error dashboard-error" role="alert">
            Some event data couldn’t be loaded, so the figures below may be incomplete.{" "}
            <button type="button" className="link-button" onClick={() => { loadEvents(); loadBookings(); }}>Retry</button>
          </p>
        )}
        {!editorOpen && <div className="event-stat-grid">
          <article><span className="event-stat-icon blue"><CalendarDots aria-hidden="true" size={19} /></span><div><strong>{eventsError ? "—" : events.length}</strong><small>Total events</small></div></article>
          <article><span className="event-stat-icon green"><CheckCircle aria-hidden="true" size={19} /></span><div><strong>{eventsError ? "—" : counts.published}</strong><small>Published</small></div></article>
          <article><span className="event-stat-icon amber"><Clock aria-hidden="true" size={19} /></span><div><strong>{eventsError ? "—" : counts.drafts}</strong><small>Drafts</small></div></article>
          <article><span className="event-stat-icon slate"><Archive aria-hidden="true" size={19} /></span><div><strong>{eventsError ? "—" : counts.archived}</strong><small>Archived</small></div></article>
          <article><span className="event-stat-icon violet"><Ticket aria-hidden="true" size={19} /></span><div><strong>{eventsError || bookingsError ? "—" : counts.ticketsSold.toLocaleString("en-GB")}</strong><small>Tickets sold</small></div></article>
          <article><span className="event-stat-icon rose"><CurrencyGbp aria-hidden="true" size={19} /></span><div><strong>{eventsError || bookingsError ? "—" : formatGBP(counts.revenuePence)}</strong><small>Total revenue</small></div></article>
        </div>}
        {status && (
          <div className={`cms-banner ${status.tone}`} role="status" aria-live="polite">
            <span>{status.message}</span>
            <button type="button" aria-label="Dismiss message" onClick={() => setStatus(null)}>&times;</button>
          </div>
        )}
        {editorOpen && <section className="event-editor-screen" id="event-editor">
        <div className="event-editor-heading">
          <button type="button" className="back-link" onClick={() => { if (confirmDiscard() === false) return; setBaseline(null); setEditorOpen(false); setEditingEvent(null); setWizardStep(0); setStatus(null); }}>&larr; Back to events</button>
          <div><p className="eyebrow">{editingEvent ? "Event details" : "New event"}</p><h2>{editingEvent ? "Edit event" : "Create event"}</h2><p>Set up the details, schedule, guest eligibility, and ticket options.</p></div>
          <div className="event-editor-top-actions"><button className="secondary-button dark-text" type="button" disabled={saving} onClick={() => save(false)}>Save draft</button><button className="primary-button" type="button" disabled={saving} onClick={() => save(true)}>{saving ? "Saving..." : "Publish event"}</button></div>
        </div>
        <div className="cms-grid">
          <form className="cms-card" onSubmit={onSubmit}>
            <div className="card-heading">
              <div>
                <p className="eyebrow">Create event</p>
                <h2>{editingEvent ? "Edit event" : "Event setup"}</h2>
              </div>
            </div>
            <p className="panel-copy">Build the event details, schedule, audience rules, and ticketing setup in a single workflow.</p>

            <div className="event-wizard-layout">
              <nav className="event-wizard-steps" aria-label="Event setup steps">
                {EVENT_WIZARD_STEPS.map((step, index) => <button type="button" className={wizardStep === index ? "active" : isStepComplete(index) ? "complete" : ""} aria-current={wizardStep === index ? "step" : undefined} key={step} onClick={() => { setWizardStep(index); setStatus(null); }}><span>{wizardStep !== index && isStepComplete(index) ? <CheckCircle aria-hidden="true" size={18} /> : index + 1}</span><span><strong>{step}</strong><small>{["Title, description, category", "Dates and sessions", "Location and capacity", "Pricing and availability", "Guest restrictions", "Images and publish"][index]}</small></span></button>)}
              </nav>
              <div className="event-wizard-main">
            <div className="cms-form">
              {wizardStep === 0 && <>
              <label>
                Event name
                <input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Autumn Woodland Trail" maxLength={120} required {...invalidProps("title")} />
                {fieldError("title")}
              </label>

              <label>
                What is happening?
                <textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={4} placeholder="Describe the experience, what is included, and what guests should bring." maxLength={2000} required {...invalidProps("description")} />
                {fieldError("description")}
                <small className="field-hint">{form.description.length}/2000</small>
              </label>
              <label>
                Event category
                <select value={form.categoryId} disabled={categoriesError} onChange={(event) => update("categoryId", event.target.value)}>
                  <option value="">General event</option>
                  {categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
                {categoriesError && <small className="field-hint field-hint-error">Categories couldn’t be loaded, so this can’t be changed right now. The current selection is preserved.</small>}
              </label>
              </>}

              {wizardStep === 1 && <>
              <p className="field-hint">Each session sets its own date, times and capacity. The first session is shown as the event date.</p>
              {fieldError("sessions")}
              <div className="form-section-heading">
                <div><p className="eyebrow">Schedule</p><h3>Sessions</h3></div>
                <button className="table-action" type="button" onClick={() => setSessions((current) => [...current, { date: "", startTime: "10:00", endTime: "", capacity: "50" }])}>+ Add session</button>
              </div>
              <div className="repeatable-fields">
                {sessions.map((session, index) => (
                  <div className="repeatable-row" key={`session-${index}`}>
                    <label>Date<input type="date" min={localDateInput(new Date())} value={session.date} onChange={(event) => updateSession(index, "date", event.target.value)} {...invalidProps(`sessions.${index}.startsAt`)} /></label>
                    <label>Start<input type="time" value={session.startTime} onChange={(event) => updateSession(index, "startTime", event.target.value)} {...invalidProps(`sessions.${index}.startsAt`)} />{fieldError(`sessions.${index}.startsAt`)}</label>
                    <label>End<input type="time" value={session.endTime} onChange={(event) => updateSession(index, "endTime", event.target.value)} {...invalidProps(`sessions.${index}.endsAt`)} />{fieldError(`sessions.${index}.endsAt`)}</label>
                    <label>Capacity<input type="number" min="1" value={session.capacity} onChange={(event) => updateSession(index, "capacity", event.target.value)} {...invalidProps(`sessions.${index}.capacity`)} />{fieldError(`sessions.${index}.capacity`)}</label>
                    {sessions.length > 1 && <button className="remove-row" type="button" aria-label={`Remove session ${index + 1}`} onClick={() => setSessions((current) => current.filter((_, sessionIndex) => sessionIndex !== index))}>&times;</button>}
                  </div>
                ))}
              </div>
              </>}

              {wizardStep === 2 && <>
              <div className="form-two">
                <label>
                  Venue
                  <input value={form.venue} onChange={(event) => update("venue", event.target.value)} maxLength={120} {...invalidProps("venue")} />
                  {fieldError("venue")}
                </label>
                <p className="field-hint">Capacity is set per session in Schedule: {totalCapacity.toLocaleString("en-GB")} {totalCapacity === 1 ? "place" : "places"} in total.</p>
              </div>
              </>}

              {wizardStep === 4 && <>
              <label>
                Booking eligibility
                <select value={form.audiencePolicy} onChange={(event) => update("audiencePolicy", event.target.value)}>
                  {AUDIENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>

              <div className="form-two">
                <label>
                  Minimum age (optional)
                  <input type="number" min="0" max="120" placeholder="No minimum" value={form.minAge} onChange={(event) => update("minAge", event.target.value)} {...invalidProps("minAge")} />
                  {fieldError("minAge")}
                </label>
                <label>
                  Maximum age (optional)
                  <input type="number" min="0" max="120" placeholder="No maximum" value={form.maxAge} onChange={(event) => update("maxAge", event.target.value)} {...invalidProps("maxAge")} />
                  {fieldError("maxAge")}
                </label>
              </div>
              </>}

              {wizardStep === 3 && <>
              <div className="form-section-heading">
                <div><p className="eyebrow">Ticketing</p><h3>Ticket types</h3></div>
                <button className="table-action" type="button" onClick={() => setTicketTypes((current) => [...current, { name: "", price: "", maxPerOrder: "10" }])}>+ Add ticket type</button>
              </div>
              {fieldError("ticketTypes")}
              <div className="repeatable-fields">
                {ticketTypes.map((ticket, index) => (
                  <div className="repeatable-row ticket-row" key={`ticket-${index}`}>
                    <label>Name<input value={ticket.name} placeholder="Child" onChange={(event) => updateTicket(index, "name", event.target.value)} {...invalidProps(`ticketTypes.${index}.name`)} />{fieldError(`ticketTypes.${index}.name`)}</label>
                    <label>Price (GBP)<input type="number" min="0" step="0.01" value={ticket.price} onChange={(event) => updateTicket(index, "price", event.target.value)} {...invalidProps(`ticketTypes.${index}.pricePence`)} />{fieldError(`ticketTypes.${index}.pricePence`)}</label>
                    <label>Max per booking<input type="number" min="1" value={ticket.maxPerOrder} onChange={(event) => updateTicket(index, "maxPerOrder", event.target.value)} {...invalidProps(`ticketTypes.${index}.maxPerOrder`)} />{fieldError(`ticketTypes.${index}.maxPerOrder`)}</label>
                    {ticketTypes.length > 1 && <button className="remove-row" type="button" aria-label={`Remove ${ticket.name || "ticket type"}`} onClick={() => setTicketTypes((current) => current.filter((_, ticketIndex) => ticketIndex !== index))}>&times;</button>}
                  </div>
                ))}
              </div>
              </>}

              {wizardStep === 5 && <div className="event-review-summary"><p className="eyebrow">Review</p><h3>{form.title || "Event name"}</h3><p>{form.description || "Add a description in Basic Information."}</p><dl><div><dt>First session</dt><dd>{firstSession ? `${formatDate(firstSession.toISOString())} · ${localTimeInput(firstSession)}` : "Not set"}</dd></div><div><dt>Venue</dt><dd>{form.venue || "Not set"}</dd></div><div><dt>Capacity</dt><dd>{totalCapacity ? `${totalCapacity.toLocaleString("en-GB")} across ${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}` : "Not set"}</dd></div><div><dt>Ticket types</dt><dd>{ticketTypes.length}</dd></div><div><dt>Guest policy</dt><dd>{audienceLabel(form.audiencePolicy)}</dd></div><div><dt>Media files</dt><dd>{featuredMedia.length + galleryMedia.length + videoMedia.length}</dd></div></dl></div>}
            </div>
            {errorCount > 0 && <p className="field-hint field-hint-error wizard-error-summary" role="alert">Please fix the {errorCount === 1 ? "highlighted field" : `${errorCount} highlighted fields`} before continuing.</p>}
            <div className="event-wizard-controls"><button className="secondary-button dark-text" type="button" disabled={wizardStep === 0} onClick={() => { setWizardStep((current) => Math.max(0, current - 1)); setStatus(null); }}>Back</button>{wizardStep < EVENT_WIZARD_STEPS.length - 1 ? <button className="primary-button" type="button" onClick={nextWizardStep}>Next: {EVENT_WIZARD_STEPS[wizardStep + 1]} <span aria-hidden="true">&rarr;</span></button> : <button className="primary-button" type="button" disabled={saving} onClick={() => save(true)}>{saving ? "Publishing..." : "Publish event"} <span aria-hidden="true">&rarr;</span></button>}</div>
              </div>
            </div>
          </form>

          <div className="cms-side">
            <div className="cms-card preview-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Live preview</p>
                  <h2>Guest view</h2>
                </div>
              </div>
              <article className="event-preview">
                <span className="preview-date">{firstSession ? formatDate(firstSession.toISOString()) : "Choose a date"}</span>
                <h3>{form.title || "Event name"}</h3>
                <p>{form.description || "Your description will appear here as guests will read it."}</p>
                <div className="preview-tags">
                  <span>{form.venue || "Hilston Park"}</span>
                  <span>{audienceLabel(form.audiencePolicy)}</span>
                  <span>{totalCapacity} places</span>
                </div>
              </article>
            </div>

            {wizardStep === 5 && <div className="cms-card event-media-step" id="media">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">Images and video</p>
                  <h2>Event media</h2>
                </div>
              </div>
              <div className="media-upload-grid">
                <label className="upload-zone media-upload-card"><strong>Featured image</strong><small>One image, up to {mediaMaxMb} MB</small><input type="file" accept="image/*" onChange={(event) => upload(event, "featured")} /></label>
                <label className="upload-zone media-upload-card"><strong>Gallery images</strong><small>Multiple images, up to {mediaMaxMb} MB each</small><input type="file" accept="image/*" multiple onChange={(event) => upload(event, "gallery")} /></label>
                <label className="upload-zone media-upload-card"><strong>Videos</strong><small>Video files, up to {mediaMaxMb} MB each</small><input type="file" accept="video/*" multiple onChange={(event) => upload(event, "video")} /></label>
              </div>
              {uploadProgress && <p className="panel-copy">{uploadProgress}</p>}
              {[...featuredMedia, ...galleryMedia, ...videoMedia].length > 0 && (
                <ul className="media-list">
                  {featuredMedia.map((file) => <li key={`featured-${file.name}-${file.lastModified}`}><span>Featured</span>{file.name}</li>)}
                  {galleryMedia.map((file) => <li key={`gallery-${file.name}-${file.lastModified}`}><span>Gallery</span>{file.name}</li>)}
                  {videoMedia.map((file) => <li key={`video-${file.name}-${file.lastModified}`}><span>Video</span>{file.name}</li>)}
                </ul>
              )}
            </div>}
          </div>
        </div>
        </section>}

        {!editorOpen && <section className="cms-card events-panel">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Event catalogue</p>
              <h2>All events <span className="event-total">{events.length}</span></h2>
            </div>
            <div className="event-status-tabs" aria-label="Filter events by status">
              <button className={statusFilter === "all" ? "active" : ""} type="button" onClick={() => { setStatusFilter("all"); resetListSelection(); }}>All Events <span>{events.length}</span></button>
              <button className={statusFilter === "published" ? "active" : ""} type="button" onClick={() => { setStatusFilter("published"); resetListSelection(); }}>Published <span>{counts.published}</span></button>
              <button className={statusFilter === "draft" ? "active" : ""} type="button" onClick={() => { setStatusFilter("draft"); resetListSelection(); }}>Drafts <span>{counts.drafts}</span></button>
              <button className={statusFilter === "archived" ? "active" : ""} type="button" onClick={() => { setStatusFilter("archived"); resetListSelection(); }}>Archived <span>{counts.archived}</span></button>
            </div>
          </div>

          <div className="event-list-toolbar" aria-label="Event list filters">
            <label className="search-field">
              <span>Search events</span>
              <input type="search" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); resetListSelection(); }} placeholder="Search by event or venue" />
            </label>
            <label className="filter-field">
              <span>Category</span>
              <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); resetListSelection(); }}>
                <option value="all">All categories</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="filter-field">
              <span>Venue</span>
              <select value={venueFilter} onChange={(event) => { setVenueFilter(event.target.value); resetListSelection(); }}>
                <option value="all">All venues</option>
                {venues.map((venue) => <option key={venue} value={venue}>{venue}</option>)}
              </select>
            </label>
            <button className="table-action reset-filters" type="button" onClick={resetFilters}>Reset</button>
          </div>

          {selectedIds.size > 0 && (
            <div className="event-bulk-bar" role="toolbar" aria-label="Bulk actions">
              <span>{selectedIds.size} selected</span>
              <button className="table-action" type="button" disabled={saving} onClick={() => bulkSetArchived(true)}>Archive</button>
              <button className="table-action" type="button" disabled={saving} onClick={() => bulkSetArchived(false)}>Restore</button>
              <button className="table-action danger" type="button" disabled={saving} onClick={bulkDelete}>Delete</button>
              <button className="table-action" type="button" onClick={() => setSelectedIds(new Set())}>Clear</button>
            </div>
          )}

          {loadingEvents && <p className="panel-copy">Loading events&#8230;</p>}

          {!loadingEvents && filteredEvents.length === 0 && (
            <div className="events-empty">
              <span aria-hidden="true">&#9671;</span>
              <strong>No matching events</strong>
              <small>Try another search term or clear one of the filters.</small>
            </div>
          )}

          {!loadingEvents && filteredEvents.length > 0 && <div className="event-table-wrap"><table className="event-management-table"><thead><tr><th className="event-table-checkbox"><input type="checkbox" aria-label="Select all events on this page" checked={paginatedEvents.length > 0 && paginatedEvents.every((event) => selectedIds.has(event.id))} onChange={toggleSelectAllOnPage} /></th><th>Event</th><th>Date &amp; time</th><th>Venue</th><th>Tickets sold</th><th>Revenue</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {paginatedEvents.map((event) => {
              const statusValue = computeStatusValue(event);
              const eventTotals = bookingTotalsByEvent.get(event.id) || { tickets: 0, testTickets: 0, revenuePence: 0, activeTickets: 0, bookings: 0 };
              const badge = audienceBadge(event);
              return <tr key={event.id}>
                <td className="event-table-checkbox"><input type="checkbox" aria-label={`Select ${event.title}`} checked={selectedIds.has(event.id)} onChange={() => toggleSelected(event.id)} /></td>
                <td><div className="event-table-title"><span className="event-table-mark"><CalendarDots aria-hidden="true" size={17} /></span><span><strong>{event.title}</strong><small>{event.category || "General event"}{badge ? ` \u00b7 ${badge}` : ""}</small></span></div></td>
                <td>{formatDate(event.startsAt)}<small>{formatTime(event.startsAt)}</small></td>
                <td>{event.venue}</td>
                <td>{eventTotals.tickets} <span className="table-muted">/ {event.capacity}</span>{eventTotals.testTickets > 0 && <small className="table-muted" style={{ display: "block" }}>+ {eventTotals.testTickets} test {eventTotals.testTickets === 1 ? "place" : "places"} held</small>}</td>
                <td>{formatGBP(eventTotals.revenuePence)}</td>
                <td><span className={`event-status-pill ${statusValue}`}><i />{formatStatusLabel(statusValue)}</span></td>
                <td><div className="event-table-actions"><button className="table-action" type="button" disabled={saving} onClick={() => startEditing(event)}>Edit</button><Link className="table-action" href={`/manage/events/${event.id}`}>View</Link><details className="event-actions-menu"><summary aria-label={`More actions for ${event.title}`}>&hellip;</summary><div className="event-actions-popover">{!event.archived && <button className="table-action" type="button" disabled={saving} onClick={() => setPublication(event, !event.published)}>{event.published ? "Take down" : "Publish"}</button>}<button className="table-action" type="button" disabled={saving} onClick={() => setArchived(event, !event.archived)}>{event.archived ? "Restore" : "Archive"}</button><button className="table-action danger" type="button" disabled={saving} onClick={() => deleteEvent(event)}>Delete</button></div></details></div></td>
              </tr>;
            })}
          </tbody></table>
          <div className="event-table-pagination">
            <p>Showing {filteredEvents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredEvents.length)} of {filteredEvents.length} events</p>
            <div className="event-table-pages">
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page">&lsaquo;</button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                <button key={pageNumber} type="button" className={pageNumber === currentPage ? "active" : ""} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
              ))}
              <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} aria-label="Next page">&rsaquo;</button>
            </div>
            <label className="page-size-field">
                  <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); resetListSelection(); }}>
                <option value={6}>6 per page</option>
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
              </select>
            </label>
          </div>
          </div>}
        </section>}

        {!editorOpen && <section className="storefront-preview" id="publishing">
          <div>
            <p className="eyebrow">Publishing</p>
            <h2>Ready to publish</h2>
            <p>Your event information is ready to be connected to your website or booking destination when the publication settings are in place.</p>
          </div>
        </section>}
      </section>

      <footer className="footer">
        <Link href="/manage">Dashboard</Link>
        <Link href="/">Ticketing home</Link>
      </footer>
    </StaffShell>
  );
}
