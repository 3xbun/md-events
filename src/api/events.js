import axios from "axios";
import { NOCODB_BASE, BASE_ID, EVENTS_TABLE, hdrs } from "./nocodb.js";

const url = (p) => `${NOCODB_BASE}/v3/data/${BASE_ID}/${EVENTS_TABLE}/records`;

/** Active events, soonest show first. */
export async function listActiveEvents() {
  const res = await axios.get(
    url(),
    {
      params: {
        where: "(IsActive,checked)",
        limit: "100",
        sort: JSON.stringify([{ field: "ShowDate", direction: "asc" }]),
      },
      headers: hdrs(),
    }
  );
  return res.data?.records ?? [];
}

/** Every event (admin). */
export async function listAllEvents() {
  const res = await axios.get(
    url(),
    {
      params: {
        limit: "200",
        sort: JSON.stringify([{ field: "ShowDate", direction: "desc" }]),
      },
      headers: hdrs(),
    }
  );
  return res.data?.records ?? [];
}

/** One event by numeric id. */
export async function getEvent(id) {
  const res = await axios.get(
    url(),
    { params: { where: `(Id,eq,${Number(id)})` }, headers: hdrs() }
  );
  return res.data?.records?.[0] ?? null;
}

/** Create an event. `fields` are the writable event columns. */
export async function createEvent(fields) {
  const res = await axios.post(url(), { fields }, { headers: hdrs() });
  const rec = res.data?.records?.[0];
  if (!rec) throw new Error("event create failed");
  return rec;
}

/** Update an event by numeric id (v3 batch-update shape). */
export async function updateEvent(id, fields) {
  const res = await axios.patch(url(), [{ id: Number(id), fields }], {
    headers: hdrs(),
  });
  return res.data?.records?.[0] ?? null;
}

/** Delete an event by numeric id. */
export async function deleteEvent(id) {
  await axios.delete(url(), { data: [{ id: Number(id) }], headers: hdrs() });
}
