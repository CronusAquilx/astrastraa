import { createFileRoute } from "@tanstack/react-router";

/**
 * Qaisflixx relay: serves qaisflix.lovable.app under /qf/* from Astra's own
 * domain. Fixed upstream only (not an open proxy).
 */
const TMDB_KEY = "0ea74aa80d71c4dc484c0a58f26ea7b8";
const ORIGIN = "https://qaisflix.lovable.app";
const DROP = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive",
  "x-frame-options", "content-security-policy", "content-security-policy-report-only", "set-cookie", "strict-transport-security"]);

async function handle({ request, params }: { request: Request; params: { _splat?: string } }) {
  const url = new URL(request.url);
  const path = "/" + (params._splat ?? "");
  // Qaisflixx's own TMDB key is rejected, so serve TMDB calls with Astra's key.
  if (path.startsWith("/__tmdb/")) {
    const t = new URL("https://api.themoviedb.org/3/" + path.slice(8));
    url.searchParams.forEach((v, k) => { if (k !== "api_key") t.searchParams.set(k, v); });
    t.searchParams.set("api_key", TMDB_KEY);
    const r = await fetch(t);
    return new Response(r.body, { status: r.status, headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } });
  }
  const upstream = await fetch(ORIGIN + path + url.search, {
    headers: { "user-agent": request.headers.get("user-agent") ?? "Mozilla/5.0", accept: request.headers.get("accept") ?? "*/*" },
    redirect: "follow",
  }).catch(() => null);
  if (!upstream) return new Response("Qaisflixx is unreachable", { status: 502 });

  const headers = new Headers();
  upstream.headers.forEach((v, k) => { if (!DROP.has(k.toLowerCase())) headers.set(k, v); });
  const type = upstream.headers.get("content-type") ?? "";
  if (!type.includes("text/html")) return new Response(upstream.body, { status: upstream.status, headers });

  // Point root-relative assets at /qf/, and show the SPA its real path so its router doesn't 404.
  let html = (await upstream.text())
    .replace(/(\s(?:src|href)\s*=\s*["'])\/(?!\/|qf\/)/gi, "$1/qf/")
    .replaceAll(ORIGIN + "/", "/qf/");
  const fix = `<script>history.replaceState(history.state,"",${JSON.stringify(path)}+location.search+location.hash);` +
    `(function(){var T="https://api.themoviedb.org/3/";function w(u){return typeof u==="string"&&u.indexOf(T)===0?"/qf/__tmdb/"+u.slice(T.length):u}` +
    `var of=fetch;window.fetch=function(i,n){if(typeof i==="string"&&i.indexOf(T)===0){i=w(i);if(n&&n.headers){n=Object.assign({},n);var h=new Headers(n.headers);h.delete("authorization");n.headers=h}}else if(i&&i.url&&i.url.indexOf(T)===0){i=new Request(w(i.url),{method:i.method})}return of.call(this,i,n)};` +
    `var oo=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){arguments[1]=w(String(u));return oo.apply(this,arguments)}})();</script>`;
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + fix) : fix + html;
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(html, { status: 200, headers });
}

export const Route = createFileRoute("/qf/$")({ server: { handlers: { GET: handle } } });
