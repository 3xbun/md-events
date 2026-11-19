/**
 * Rich-text sanitizer for events.Description.
 *
 * The admin description editor (contenteditable + execCommand) produces
 * browser HTML: <b>/<i>/<u>, <h2>/<h3>, <p>/<div>/<br>, <ul>/<ol>/<li>, and
 * <span style="color:#...">. This whitelist sanitizer keeps exactly those
 * tags, drops every other tag (keeping its text content), and strips ALL
 * attributes — except a <span>'s color (hex or rgb), re-emitted as a safe
 * inline style. Text nodes pass through untouched (DOMParser escaping is
 * intact).
 *
 * Both the admin editor and the customer page call the SAME function, so
 * what customers see is provably the sanitized subset.
 */
const RT_ALLOWED_TAGS = new Set(["B", "I", "U", "H2", "H3", "P", "BR", "DIV", "UL", "OL", "LI", "SPAN"]);
// Color values survive as-is if they are a clean hex or rgb() form — both are
// safe to re-emit; anything else (e.g. color: currentColor) is dropped.
const COLOR_RE = /color\s*:\s*(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+)?\s*\))/;

export function sanitizeRichText(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  const walk = (node) => {
    const out = [];
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        out.push(child.nodeValue);
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName;
      if (!RT_ALLOWED_TAGS.has(tag)) {
        out.push(...walk(child));
        continue;
      }
      let attr = "";
      if (tag === "SPAN") {
        const m = (child.getAttribute("style") || "").match(COLOR_RE);
        if (m) attr = ` style="color:${m[1].toLowerCase()}"`;
      }
      const inner = walk(child).join("");
      out.push(`<${tag.toLowerCase()}${attr}>${inner}</${tag.toLowerCase()}>`);
    }
    return out;
  };
  let txt = walk(doc.body).join("");
  // Normalise <div> (Chrome contenteditable block) to <p>
  txt = txt.replace(/<div>/gi, "<p>").replace(/<\/div>/gi, "</p>");
  // Drop empty paragraphs (incl. <p><br></p> left by contenteditable)
  txt = txt.replace(/<p>\s*(?:<br\s*\/?>\s*)*<\/p>/gi, "");
  return txt.trim();
}

/**
 * Customer-side render: returns safe HTML for v-html.
 * Values written by the editor are sanitized; legacy plain-text values
 * (no HTML tags at all) are entity-escaped and wrapped in a <p> so
 * pre-rich-text events still display.
 */
export function renderRichText(raw) {
  const v = String(raw ?? "");
  if (!v.trim()) return "";
  const looksHtml = /<[a-z][\s\S]*>/i.test(v);
  if (!looksHtml) {
    const esc = v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc.trim() ? `<p>${esc}</p>` : "";
  }
  return sanitizeRichText(v);
}
