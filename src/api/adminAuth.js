// 6-digit staff PIN gate for /admin.
// Only the SHA-256 (hex) of the PIN ships in the bundle.
// PIN for md-events: 201106 (change by regenerating the hash below).
export const PIN_HASH =
  "30e786775ba66864ae9b0efc629845ab9b1f71f24c45196bf97d593955c15567";

const UNLOCK_KEY = "md-events.admin-unlocked";

export function isUnlocked() {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function ctEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const sha256Hex = async (text) => {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export async function tryUnlockPin(pin) {
  const hash = await sha256Hex(String(pin ?? "").trim());
  if (!ctEqual(hash, PIN_HASH)) return false;
  try {
    sessionStorage.setItem(UNLOCK_KEY, "1");
  } catch {
    /* private mode */
  }
  return true;
}
