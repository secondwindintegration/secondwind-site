// Rewrites the shared index.html <head> for each public URL so a crawl of the
// HTML sees that page's title, description and canonical. Client-side routing
// updates the same tags after a click. Titles live in #page-meta in index.html.

const ALIAS = { packages: "prices", "free-estimate": "start" };

export function resolveId(pathname) {
  let path = String(pathname || "/").split("?")[0].split("#")[0];
  try { path = decodeURIComponent(path); } catch (e) { /* keep the raw path */ }
  path = path.replace(/\/+$/, "");
  if (path === "" || path === "/index.html") return "home";
  const seg = path.replace(/^\//, "").replace(/\.html$/, "");
  if (!seg || seg.includes("/")) return "home";
  return ALIAS[seg] || seg;
}

function escapeText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function escapeAttr(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}

export function rewriteHtml(html, pathname) {
  const match = html.match(/<script type="application\/json" id="page-meta">([\s\S]*?)<\/script>/);
  if (!match) return null;
  let pages;
  try { pages = JSON.parse(match[1]); } catch (e) { return null; }
  const id = resolveId(pathname);
  const chosen = pages[id] && pages[id].title ? id : "home";
  const meta = pages[chosen];
  if (!meta || !meta.title) return null;
  const url = "https://secondwindintegration.com" + (chosen === "home" ? "/" : "/" + chosen);
  const title = escapeText(meta.title);
  const desc = escapeAttr(meta.description || "");
  let out = html;
  // Function replacers keep prices such as A$149 literal. A string replacer would treat $ as a pattern.
  out = out.replace(/<title>[^<]*<\/title>/, () => "<title>" + title + "</title>");
  out = out.replace(/(<meta property="og:title" content=")[^"]*(")/, (_, open, close) => open + escapeAttr(meta.title) + close);
  out = out.replace(/(<meta property="og:description" content=")[^"]*(")/, (_, open, close) => open + desc + close);
  out = out.replace(/(<meta property="og:url" content=")[^"]*(")/, (_, open, close) => open + url + close);
  out = out.replace(/(<meta name="description" content=")[^"]*(")/, (_, open, close) => open + desc + close);
  out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, (_, open, close) => open + url + close);
  if (chosen !== "home") out = out.replace(/<script type="application\/ld\+json" id="local-business">[\s\S]*?<\/script>\s*/, "");
  return out;
}

export default async (request, context) => {
  const response = await context.next();
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return response;
  const fallback = response.clone();
  try {
    const html = await response.text();
    const next = rewriteHtml(html, new URL(request.url).pathname);
    const headers = new Headers(fallback.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.delete("etag");
    return new Response(next == null ? html : next, { status: fallback.status, statusText: fallback.statusText, headers });
  } catch (e) {
    return fallback;
  }
};
