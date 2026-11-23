// Client-side image compression: encode a decoded HTMLImageElement as a JPEG
// data URL guaranteed to stay under NocoDB's LongText cap (100000 chars).
// The base64 STRING length is what NocoDB limits — not the JPEG byte count —
// so we compress adaptively: step the width down, then the JPEG quality,
// until the encoded string fits. Used for customer bank-transfer slips
// (bookings.Slip); the admin poster pipeline (Admin.vue) has its own
// 3:4 center-crop variant of the same ladder.
const MAX_LEN = 95000; // base64 chars — margin under the 100000 cap
const WIDTH_LADDER = [800, 700, 600, 500, 400];
const QUALITY_LADDER = [0.7, 0.6, 0.5, 0.4, 0.32, 0.25];

// Fit (no crop) an image into a maxW-wide box, preserving aspect ratio.
function encodeFitted(img, maxW, quality) {
  const outW = Math.min(maxW, img.width || maxW);
  const outH = Math.max(1, Math.round((outW * (img.height || maxW)) / (img.width || maxW)));
  if (!outW || !outH) return null;
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, outW, outH);
  const url = canvas.toDataURL("image/jpeg", quality);
  return url.length <= MAX_LEN ? url : null;
}

// Encode an image element as a JPEG data URL <= MAX_LEN chars, or null if
// even the smallest/lowest-quality pass is too big.
export function encodeToDataUrl(img) {
  for (const maxW of WIDTH_LADDER) {
    for (const q of QUALITY_LADDER) {
      const url = encodeFitted(img, maxW, q);
      if (url) return url;
    }
  }
  return null;
}

// Load a File/Blob into an HTMLImageElement (rejects on decode failure).
export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image decode failed"));
    };
    img.src = url;
  });
}
