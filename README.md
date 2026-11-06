# md-events — Seat Reservation

A seat-reservation service (Thai Ticket Major / Major Cineplex style). Vue 3 +
Vue Router SPA, data in NocoDB.

## Stack
- Vue 3 + Vite + Vue Router (SPA)
- axios → NocoDB (`https://ndb.3xbun.com`, base `pvjyre4yvkmnmx2`)
- Font Awesome duotone icons, IBM Plex Sans Thai
- Bilingual UI: Thai (default) + English (header toggle)
- Deploy: Cloudflare Pages (SPA fallback `/* → index.html`)

## Seat model
Rows **A–P**, columns **1–26**. The grid is **persistent + expandable per
show**: each event stores `MaxRow` (A–P) and `MaxColumn` (1–26), and the app
renders exactly that many seats — not always the full 416.

## Tables
- **events** (`m2slrm1jwrazsu8`) — Title, Venue, Description, ShowDate,
  StartTime, Price, MaxRow, MaxColumn, IsActive
- **bookings** (`mv4w1ocptwrt1rm`) — BookingCode, CustomerName, Email, Phone,
  Seats (JSON array), SeatCount, Total, Status (reserved/paid/cancelled),
  CardLast4, Notes, Event (Links→events), EventId (Number filter column)

A seat is **occupied** by any non-cancelled booking for its event.

## Flow
1. **Home** (`/`) — list active events
2. **Event** (`/event/:id`) — seat map; tap free seats to select (up to 8)
3. **Checkout** (`/checkout/:id`) — customer + **mock** card form (no real charge)
4. **Confirmation** (`/confirmation/:code`) — booking code + ticket
5. **Admin** (`/admin`) — 6-digit PIN gate, create/edit/delete events, booking history

## Dev
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
npm run preview    # serve the build
```

## Admin PIN
Default staff PIN is `201106` (SHA-256 in `src/api/adminAuth.js`). Change it by
replacing `PIN_HASH` with `sha256(newPin)`.

## NocoDB token
The `xc-token` ships in the SPA by standing choice (same convention as
md-exhibition) — see `src/api/nocodb.js`.

## Status
- [x] Schema created in NocoDB (events + bookings + relation + EventId)
- [x] Full Vue app: browse → seat map → mock payment → confirmation
- [x] Admin event CRUD + booking history
- [x] Bilingual TH/EN (Thai copy is LLM-generated + structurally verified;
      **pending a native-eye proofread** for tone-mark placement)
- [ ] Deploy to Cloudflare Pages
- [ ] (phase 2) real payment gateway
