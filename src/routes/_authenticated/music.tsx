import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic2, Pause, Play, Search, SkipBack, SkipForward } from "lucide-react";
import { usePrefs } from "@/lib/astra/prefs";
import { openProxied } from "@/lib/astra/proxy";
import { relayToken } from "@/lib/movies/tmdb";
import { MobileMenuButton } from "@/components/astra/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/music")({
  head: () => ({ meta: [{ title: "Music — Astra" }] }),
  component: Music,
});

type Track = { id: string; title: string; artist: string; album: string; art: string };

async function api<T>(params: Record<string, string>): Promise<T> {
  const res = await fetch(`/api/music?${new URLSearchParams(params)}`, { headers: { authorization: `Bearer ${relayToken()}` } });
  if (!res.ok) throw new Error(`Music relay ${res.status}`);
  return res.json();
}
const artUrl = (src: string) => (src ? `/api/music?op=art&src=${encodeURIComponent(src)}&token=${encodeURIComponent(relayToken())}` : "");

function Music() {
  const prefs = usePrefs();
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("Top songs");
  const [list, setList] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [cur, setCur] = useState<number>(-1);
  const [status, setStatus] = useState("");
  const [lyrics, setLyrics] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const track = cur >= 0 ? list[cur] : undefined;

  useEffect(() => {
    api<Track[]>({ op: "top" }).then(setList).catch(() => setList([])).finally(() => setLoading(false));
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setTitle(`Results for "${q.trim()}"`);
    try { setList(await api<Track[]>({ op: "search", q: q.trim() })); } catch { setList([]); }
    setCur(-1); setLoading(false);
  }

  async function play(i: number) {
    const t = list[i];
    if (!t || !frameRef.current) return;
    setCur(i); setLyrics(null); setStatus("Finding song…");
    try {
      const { ids } = await api<{ ids: string[] }>({ op: "video", q: `${t.artist} ${t.title}` });
      if (!ids[0]) { setStatus("Couldn't find a playable version"); return; }
      setStatus("Loading through proxy…");
      await openProxied(frameRef.current, `https://www.youtube.com/embed/${ids[0]}?autoplay=1&playsinline=1&rel=0`, prefs);
      setStatus("");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Playback failed"); }
  }

  async function showLyrics() {
    if (!track) return;
    if (lyrics !== null) return setLyrics(null);
    setLyrics("Loading…");
    const r = await api<{ lyrics: string }>({ op: "lyrics", q: track.title, artist: track.artist }).catch(() => ({ lyrics: "" }));
    setLyrics(r.lyrics || "No lyrics found.");
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <MobileMenuButton />
        <form onSubmit={search} className="flex flex-1 items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search songs or artists" className="w-full bg-transparent text-sm outline-none" />
        </form>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <h1 className="font-display text-4xl">Music</h1>
          <p className="mt-1 text-sm text-muted-foreground">{title}</p>
          {loading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {list.map((t, i) => (
                <button key={`${t.id}-${i}`} onClick={() => play(i)} className={cn("group rounded-lg border bg-card p-2 text-left transition hover:bg-accent", i === cur && "ring-2 ring-primary")}>
                  <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                    {t.art && <img src={artUrl(t.art)} alt="" loading="lazy" className="size-full object-cover" />}
                    <span className="absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground opacity-0 shadow transition group-hover:opacity-100"><Play className="size-4" /></span>
                  </div>
                  <div className="mt-2 truncate text-sm font-medium">{t.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
                </button>
              ))}
              {list.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Nothing found.</p>}
            </div>
          )}
          {lyrics !== null && <pre className="mt-6 whitespace-pre-wrap rounded-lg border bg-card p-4 font-sans text-sm leading-relaxed">{lyrics}</pre>}
        </div>
      </div>

      <div className={cn("shrink-0 border-t bg-card", !track && "hidden")}>
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2">
          {track?.art && <img src={artUrl(track.art)} alt="" className="size-11 rounded-md object-cover" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{track?.title}</div>
            <div className="truncate text-xs text-muted-foreground">{status || track?.artist}</div>
          </div>
          <button onClick={() => play(Math.max(0, cur - 1))} className="rounded-md p-2 hover:bg-accent" aria-label="Previous"><SkipBack className="size-4" /></button>
          <button onClick={() => { setCur(-1); if (frameRef.current) frameRef.current.src = "about:blank"; }} className="rounded-full bg-primary p-2 text-primary-foreground" aria-label="Stop"><Pause className="size-4" /></button>
          <button onClick={() => play(Math.min(list.length - 1, cur + 1))} className="rounded-md p-2 hover:bg-accent" aria-label="Next"><SkipForward className="size-4" /></button>
          <button onClick={showLyrics} className={cn("rounded-md p-2 hover:bg-accent", lyrics !== null && "bg-accent")} aria-label="Lyrics"><Mic2 className="size-4" /></button>
          <iframe ref={frameRef} title="Player" className="h-11 w-20 rounded-md border-0" allow="autoplay; encrypted-media" />
        </div>
      </div>
    </div>
  );
}
