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

/**
 * Bookings for one event. A seat is occupied by any non-cancelled booking.
 * Filters on the plain EventId Number column (relation `where` filters
 * silently return zero rows on this NocoDB build — see nocodb skill).
 * Returns an array of booking records (v3 shape {id, fields}).
 */
export async function listBookingsForEvent(eventId) {
  try {
    const res = await axios.get(url(), {
      params: { where: `(EventId,eq,${Number(eventId)})`, limit: "500" },
      headers: hdrs(),
    });
    return res.data?.records ?? [];
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
  return res.data?.records?.[0] ?? null;
}

/** Set a booking's status (e.g. confirm a payment, cancel). */
export async function setBookingStatus(id, status) {
  await axios.patch(url(), [{ id: Number(id), fields: { Status: status } }], {
    headers: hdrs(),
  });
}

export const STATUSES = { PENDING, CONFIRMED, CANCELLED, RESERVED, PAID };
export const isPaidStatus = (s) =>
  ["pending", "confirmed", "paid"].includes(String(s || "").toLowerCase());
export const isConfirmedStatus = (s) =>
  ["confirmed", "paid"].includes(String(s || "").toLowerCase());
