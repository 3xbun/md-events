import axios from "axios";
import {
  NOCODB_BASE,
  BASE_ID,
  BOOKINGS_TABLE,
  BOOKING_EVENT_LINK,
  hdrs,
} from "./nocodb.js";

const url = (p) => `${NOCODB_BASE}/v3/data/${BASE_ID}/${BOOKINGS_TABLE}/records`;

const RESERVED = "reserved";
const PAID = "paid";
const CANCELLED = "cancelled";

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
 * Create a booking and link it to its event.
 * booking: { CustomerName, Email, Phone, Seats:[...], SeatCount, Total, Status, CardLast4 }
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
        Status: booking.Status ?? PAID,
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

/** Set a booking's status (e.g. cancel). */
export async function setBookingStatus(id, status) {
  await axios.patch(url(), [{ id: Number(id), fields: { Status: status } }], {
    headers: hdrs(),
  });
}

export const STATUSES = { RESERVED, PAID, CANCELLED };
