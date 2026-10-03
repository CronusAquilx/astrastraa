import { createFileRoute } from "@tanstack/react-router";

/**
 * Qaisflixx relay: serves qaisflix.lovable.app under /qf/* from Astra's own
 * domain. Fixed upstream only (not an open proxy).
 */
const ORIGIN = "https://qaisflix.lovable.app";
const DROP = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive",
  "x-frame-options", "content-security-policy", "content-security-policy-report-only", "set-cookie", "strict-transport-security"]);

async function handle({ request, params }: { request: Request; params: { _splat?: string } }) {
  const url = new URL(request.url);
  const path = "/" + (params._splat ?? "");
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
  const fix = `<script>history.replaceState(history.state,"",${JSON.stringify(path)}+location.search+location.hash);</script>`;
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + fix) : fix + html;
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(html, { status: 200, headers });
}

export const Route = createFileRoute("/qf/$")({ server: { handlers: { GET: handle } } });
