import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest } from "@/lib/astra/api-user.server";

/** Music relay: iTunes catalog, artwork, lyrics and YouTube lookups load through Astra's server. */
const YT_KEY = "AIzaSyCc5PPxKMk7-hqMK284HwnMISd13wIF15Y";

async function authed(request: Request, url: URL) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("token") || "";
  if (!token) return false;
  return Boolean(await authenticateRequest(new Request(request.url, { headers: { authorization: `Bearer ${token}` } })));
}

function json(data: unknown, cache = 300) {
  return Response.json(data, { headers: { "cache-control": `private, max-age=${cache}` } });
}

async function handle({ request }: { request: Request }) {
  const url = new URL(request.url);
  if (!(await authed(request, url))) return new Response("Unauthorized", { status: 401 });
  const q = (url.searchParams.get("q") ?? "").slice(0, 200);

  switch (url.searchParams.get("op")) {
    case "top": {
      const r = await fetch("https://itunes.apple.com/us/rss/topsongs/limit=50/json");
      const d: any = await r.json().catch(() => ({}));
      const tracks = (d?.feed?.entry ?? []).map((e: any) => ({
        id: e.id?.attributes?.["im:id"] ?? "",
        title: e["im:name"]?.label ?? "",
        artist: e["im:artist"]?.label ?? "",
        album: e["im:collection"]?.["im:name"]?.label ?? "",
        art: (e["im:image"]?.[2]?.label ?? "").replace(/\d+x\d+bb/, "400x400bb"),
      }));
      return json(tracks, 1800);
    }
    case "search": {
      const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=30&country=us`);
      const d: any = await r.json().catch(() => ({}));
      return json((d.results ?? []).map((t: any) => ({
        id: String(t.trackId), title: t.trackName, artist: t.artistName, album: t.collectionName,
        art: (t.artworkUrl100 ?? "").replace(/\d+x\d+bb/, "400x400bb"),
      })));
    }
    case "art": {
      const src = url.searchParams.get("src") ?? "";
      if (!/^https:\/\/[a-z0-9.-]+\.mzstatic\.com\//i.test(src)) return new Response("Bad url", { status: 400 });
      const r = await fetch(src);
      return new Response(r.body, { status: r.status, headers: { "content-type": r.headers.get("content-type") ?? "image/jpeg", "cache-control": "private, max-age=86400" } });
    }
    case "lyrics": {
      const artist = url.searchParams.get("artist") ?? "";
      const r = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(q)}`).catch(() => null);
      const d: any = r?.ok ? await r.json().catch(() => ({})) : {};
      return json({ lyrics: d.lyrics ?? "" }, 86400);
    }
    case "video": {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=8&videoEmbeddable=true&q=${encodeURIComponent(q)}&key=${YT_KEY}`);
      if (!r.ok) return json({ ids: [], error: `YouTube ${r.status}` }, 0);
      const d: any = await r.json();
      const ids = (d.items ?? []).map((i: any) => i?.id?.videoId).filter((v: unknown) => typeof v === "string" && /^[\w-]{11}$/.test(v));
      return json({ ids }, 86400);
    }
  }
  return new Response("Unknown op", { status: 400 });
}

export const Route = createFileRoute("/api/music")({ server: { handlers: { GET: handle } } });
