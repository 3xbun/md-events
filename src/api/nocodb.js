// NocoDB config for the md-events seat-reservation app.
// The xc-token ships in the SPA by standing choice (same convention as md-exhibition).
// Base: pvjyre4yvkmnmx2 (md-events seat reservation)
export const NOCODB_BASE = "https://ndb.3xbun.com/api";
export const TOKEN = "3jFXBW3Q7u8bG1ITW0SevPfYNoi_mDfICFORPSkw";
export const BASE_ID = "pvjyre4yvkmnmx2";
export const EVENTS_TABLE = "m2slrm1jwrazsu8";
export const BOOKINGS_TABLE = "mv4w1ocptwrt1rm";
// bookings.Event Links -> events (field id)
export const BOOKING_EVENT_LINK = "ceuii7ldv1fm5nb";

export const hdrs = () => ({
  "xc-token": TOKEN,
  "Content-Type": "application/json",
});
