// In-memory seat selection for the current checkout flow.
// Lives in module scope so it survives the /event/:id -> /checkout/:id nav
// (component state would be lost). Cleared once a booking is created.
// `event` is the full event record (v3 shape) so zone pricing works at
// checkout without a re-fetch.

const state = {
  eventId: null,
  seats: [],
  event: null,
};

export function setSelection(eventId, seats, event) {
  state.eventId = eventId;
  state.seats = seats;
  state.event = event;
}

export function getSelection() {
  return { eventId: state.eventId, seats: [...state.seats], event: state.event };
}

export function clearSelection() {
  state.eventId = null;
  state.seats = [];
  state.event = null;
}
