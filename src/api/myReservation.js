// localStorage-backed "my reservations" (no accounts/passwords),
// mirroring md-exhibition's myBadge.js.
// A customer keeps their reservations on their own phone; the most recent
// one (or list) powers the header "My Reservation" shortcut.
const KEY = "md-events.reservations";
const MAX = 10;

/** Read all locally stored reservations (newest last). */
export function getMyReservations() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Most recently saved reservation, or null. */
export function getLatestReservation() {
  const list = getMyReservations();
  return list.length ? list[list.length - 1] : null;
}

/**
 * Save a reservation (by code); dedupes and trims to MAX newest.
 * item: { code, name, seats, total, eventTitle, status }
 */
export function saveMyReservation(item) {
  const code = String(item?.code || "").trim();
  if (!code) return;
  const list = getMyReservations().filter((r) => r.code !== code);
  list.push({ ...item, code, at: Date.now() });
  while (list.length > MAX) list.shift();
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* private mode etc. — non-fatal */
  }
  try {
    window.dispatchEvent(new Event("md-reservation-change"));
  } catch {}
}

/** Remove a reservation by code. */
export function removeMyReservation(code) {
  const c = String(code || "").trim();
  if (!c) return;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(getMyReservations().filter((r) => r.code !== c))
    );
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event("md-reservation-change"));
  } catch {}
}

/** True if a reservation code is stored on this device. */
export function hasMyReservation(code) {
  const c = String(code || "").trim();
  if (!c) return false;
  return getMyReservations().some((r) => r.code === c);
}
