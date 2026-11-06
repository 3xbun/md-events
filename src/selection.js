// In-memory seat selection for the current checkout flow.
// Lives in module scope so it survives the /event/:id -> /checkout/:id nav
// (component state would be lost). Cleared once a booking is created.

const state = {
  eventId: null,
  seats: [],
  price: 0,
};

export function setSelection(eventId, seats, price) {
  state.eventId = eventId;
  state.seats = seats;
  state.price = price;
}

export function getSelection() {
  return { ...state, seats: [...state.seats] };
}

export function clearSelection() {
  state.eventId = null;
  state.seats = [];
  state.price = 0;
}
