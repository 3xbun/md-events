import axios from "axios";
import {
  NOCODB_BASE,
  BASE_ID,
  BOOKINGS_TABLE,
  BOOKING_EVENT_LINK,
  hdrs,
} from "./nocodb.js";

const url = (p) => `${NOCODB_BASE}/v3/data/${BASE_ID}/${BOOKINGS_TABLE}/records`;

const PENDING = "pending"; // customer confirmed the bank transfer, awaiting admin
const CONFIRMED = "confirmed"; // admin verified the payment
const CANCELLED = "cancelled";
// Legacy (pre-bank-transfer) statuses, still readable on old records:
const RESERVED = "reserved";
const PAID = "paid";

// Pending bookings unpaid after 3 days are auto-rejected and their seats freed.
export const PAYMENT_EXPIRE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Parse a NocoDB timestamp ("YYYY-MM-DD HH:MM:SS.sss+00:00" or ISO) into epoch ms.
 */
function parseCreatedMs(raw) {
  if (!raw) return NaN;
  const s = String(raw).trim().replace(" ", "T");
  return Date.parse(s);
}

/**
 * True if a booking is in pending/reserved state and older than 3 days.
 */
export function isExpiredPending(rec, now = Date.now()) {
  const st = String(rec?.fields?.Status || "").toLowerCase();
  if (st !== PENDING && st !== RESERVED) return false;
  const created = parseCreatedMs(rec?.fields?.CreatedAt);
  if (!Number.isFinite(created)) return false;
  return now - created >= PAYMENT_EXPIRE_MS;
}

/**
 * Auto-reject any pending bookings in `recs` that have exceeded the 3-day
 * payment window: updates their Status to "cancelled" in NocoDB and mutates
 * the in-memory records so callers immediately see the freed seats.
 */
async function expireStaleBookings(recs) {
  const now = Date.now();
  const stale = recs.filter((r) => isExpiredPending(r, now));
  if (!stale.length) return recs;
  const payload = stale.map((r) => ({
    id: Number(r.id),
    fields: { Status: CANCELLED },
  }));
  for (const r of stale) {
    if (r.fields) r.fields.Status = CANCELLED;
  }
  try {
    await axios.patch(url(), payload, { headers: hdrs() });
  } catch {
    /* ignore write error; in-memory status still reflects expiry */
  }
  return recs;
}

/**
 * Bookings for one event. A seat is occupied by any non-cancelled booking.
 * Filters on the plain EventId Number column (relation `where` filters
 * silently return zero rows on this NocoDB build — see nocodb skill).
 * Auto-cancels pending bookings older than 3 days so seats are freed.
 * Returns an array of booking records (v3 shape {id, fields}).
 */
export async function listBookingsForEvent(eventId) {
  try {
    const res = await axios.get(url(), {
      params: { where: `(EventId,eq,${Number(eventId)})`, limit: "500" },
      headers: hdrs(),
    });
    const recs = res.data?.records ?? [];
    return await expireStaleBookings(recs);
  } catch {
    return [];
  }
}

/**
 * Seats taken (non-cancelled) for an event → array of seat labels ["A1","B2"].
 * Pending bookings count as taken: the customer has claimed them while the
 * admin verifies the payment.
 */
export async function occupiedSeats(eventId) {
  const recs = await listBookingsForEvent(eventId);
  const taken = [];
  for (const r of recs) {
    const st = r.fields?.Status;
    if (st === CANCELLED) continue;
    let arr = r.fields?.Seats;
    if (typeof arr === "string") {
      try {
        arr = JSON.parse(arr);
      } catch {
        arr = [];
      }
    }
    if (Array.isArray(arr)) taken.push(...arr);
  }
  return taken;
}

/**
 * Seat → status map for an event: { "A1": "pending" | "confirmed", ... }.
 * Only non-cancelled bookings; used to tint pending/confirmed seats on the
 * seat map.
 */
export async function seatStates(eventId) {
  const recs = await listBookingsForEvent(eventId);
  const map = {};
  for (const r of recs) {
    const st = String(r.fields?.Status || "").toLowerCase();
    if (st === CANCELLED || !(st === PENDING || st === CONFIRMED)) continue;
    let arr = r.fields?.Seats;
    if (typeof arr === "string") {
      try {
        arr = JSON.parse(arr);
      } catch {
        arr = [];
      }
    }
    if (Array.isArray(arr)) for (const s of arr) map[String(s).toUpperCase()] = st;
  }
  return map;
}

/**
 * Create a booking and link it to its event.
 * booking: { CustomerName, Email, Phone, Seats:[...], SeatCount, Total,
 *            Status (default: pending), CardLast4 }
 */
export async function createBooking(eventId, booking) {
  const res = await axios.post(
    url(),
    {
      fields: {
        BookingCode: booking.BookingCode,
        EventId: Number(eventId),
        CustomerName: booking.CustomerName,
        Email: booking.Email,
        Phone: booking.Phone,
        Seats: JSON.stringify(booking.Seats),
        SeatCount: booking.SeatCount,
        Total: booking.Total,
        Status: booking.Status ?? PENDING,
        CardLast4: booking.CardLast4,
        PaidAt: booking.PaidAt ?? null,
        Slip: booking.Slip || null,
      },
    },
    { headers: hdrs() }
  );
  const rec = res.data?.records?.[0];
  if (!rec) throw new Error("booking create failed");
  // Link the booking to its event (many-to-one).
  await axios.post(
    `${NOCODB_BASE}/v3/data/${BASE_ID}/${BOOKINGS_TABLE}/links/${BOOKING_EVENT_LINK}/${rec.id}`,
    [Number(eventId)],
    { headers: hdrs() }
  );
  return rec;
}

/** Look up a booking by its code (confirmation page). */
export async function findBookingByCode(code) {
  const c = String(code ?? "").trim();
  if (!c) return null;
  const res = await axios.get(url(), {
    params: { where: `(BookingCode,eq,${JSON.stringify(c)})` },
    headers: hdrs(),
  });
  const recs = res.data?.records ?? [];
  await expireStaleBookings(recs);
  return recs[0] ?? null;
}

/** Format a stored PaidAt ("YYYY-MM-DDTHH:MM" or "YYYY-MM-DD HH:MM") for display. */
export function formatPaidAt(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.replace("T", " ").slice(0, 16);
}

/** Format a phone string as xxx-xxx-xxxx (up to 10 digits). */
export function formatPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Set a booking's status (e.g. confirm a payment, cancel). */
export async function setBookingStatus(id, status) {
  await axios.patch(url(), [{ id: Number(id), fields: { Status: status } }], {
    headers: hdrs(),
  });
}

/** Update any fields on a booking (e.g. finance logging PaidAt/Notes). */
export async function updateBookingFields(id, fields) {
  await axios.patch(url(), [{ id: Number(id), fields }], { headers: hdrs() });
}

export const STATUSES = { PENDING, CONFIRMED, CANCELLED, RESERVED, PAID };
export const isPaidStatus = (s) =>
  ["pending", "confirmed", "paid"].includes(String(s || "").toLowerCase());
export const isConfirmedStatus = (s) =>
  ["confirmed", "paid"].includes(String(s || "").toLowerCase());
