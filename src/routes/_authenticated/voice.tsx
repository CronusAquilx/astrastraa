import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, Code2, Copy, Download, ExternalLink, Globe, ImagePlus, Loader2, Maximize2, Mic, MicOff, PhoneOff, Play, SendHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { MobileMenuButton } from "@/components/astra/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/voice")({
  head: () => ({
    meta: [
      { title: "Voice — Astra" },
      { name: "description", content: "Talk with Astra out loud, share links and images, and get things built." },
    ],
  }),
  component: VoicePage,
});

type Line = { role: "user" | "assistant"; text: string };
type Artifact =
  | { kind: "website"; url: string; title: string; screenshot: string }
  | { kind: "image"; url: string; prompt: string }
  | { kind: "html"; title: string; html: string }
  | { kind: "code"; filename: string; language: string; code: string };
type Shared = { id: number; text?: string; image?: string; name?: string; pending: boolean };

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function shrinkImage(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

function ArtifactCard({ a }: { a: Artifact }) {
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const btn = "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground";

  if (a.kind === "website") {
    return (
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
          <Globe className="size-4 text-star" />
          <span className="min-w-0 flex-1 truncate font-medium">{a.title}</span>
          <a href={a.url} target="_blank" rel="noreferrer" className={btn}><ExternalLink className="size-3" /> Open</a>
        </div>
        <img src={a.screenshot} alt={`Screenshot of ${a.title}`} className="block max-h-72 w-full object-cover object-top" loading="lazy" />
      </div>
    );
  }
  if (a.kind === "image") {
    return (
      <div className="overflow-hidden rounded-lg border bg-card">
        <img src={a.url} alt={a.prompt} className="block max-h-96 w-full object-contain" />
        <div className="flex gap-2 border-t p-2">
          <button className={btn} onClick={() => setFull(true)}><Maximize2 className="size-3" /> Preview</button>
          <button className={btn} onClick={async () => {
            try { downloadBlob(await (await fetch(a.url)).blob(), "astra-image.png"); } catch { window.open(a.url, "_blank"); }
          }}><Download className="size-3" /> Download</button>
        </div>
        {full && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4" onClick={() => setFull(false)}>
            <img src={a.url} alt={a.prompt} className="max-h-full max-w-full rounded-lg" />
          </div>
        )}
      </div>
    );
  }
  if (a.kind === "html") {
    const frame = <iframe title={a.title} srcDoc={a.html} sandbox="allow-scripts allow-forms allow-modals" className="h-full w-full bg-white" />;
    const name = `${a.title.replace(/[^\w-]+/g, "-").toLowerCase() || "page"}.html`;
    return (
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-sm">
          <span className="size-2 rounded-full bg-star" />
          <span className="min-w-0 flex-1 truncate font-medium">{a.title}</span>
          <button className={btn} onClick={() => setFull(true)}><Maximize2 className="size-3" /> Preview</button>
          <button className={btn} onClick={() => downloadBlob(new Blob([a.html], { type: "text/html" }), name)}><Download className="size-3" /> Download</button>
        </div>
        <div className="h-72">{frame}</div>
        {full && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
              <button onClick={() => setFull(false)} className="rounded p-1.5 hover:bg-accent" aria-label="Close preview"><X className="size-5" /></button>
            </div>
            <div className="flex-1">{frame}</div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 text-sm">
        <Code2 className="size-4 text-star" />
        <span className="min-w-0 flex-1 truncate font-medium">{a.filename}</span>
        <button className={btn} onClick={() => { navigator.clipboard.writeText(a.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />} Copy
        </button>
        <button className={btn} onClick={() => downloadBlob(new Blob([a.code], { type: "text/plain" }), a.filename)}><Download className="size-3" /> Download</button>
      </div>
      <pre className="max-h-72 overflow-auto p-3 font-mono text-xs">{a.code}</pre>
    </div>
  );
}

function VoicePage() {
  const [token, setToken] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [shared, setShared] = useState<Shared[]>([]);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? ""));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setToken(s?.access_token ?? ""));
    return () => data.subscription.unsubscribe();
  }, []);

  function onEvent(e: LiveEvent) {
    if (e.type === "app.artifact" && e["artifact"]) {
      setArtifacts((prev) => [...prev, e["artifact"] as Artifact]);
      return;
    }
    if (e.type === "app.delegation.pending") setWorking(true);
    if (e.type === "session.output_transcript.delta" || e.type === "app.artifact") setWorking(false);
    if (e.type === "app.context.ack" || e.type === "app.context.error") {
      setShared((prev) => prev.map((s) => ({ ...s, pending: false })));
      if (e.type === "app.context.error") toast.error("Astra couldn't read that one.");
      return;
    }
    const role = e.type === "session.input_transcript.delta" ? "user" : e.type === "session.output_transcript.delta" ? "assistant" : null;
    if (!role || typeof e["delta"] !== "string") return;
    const delta = e["delta"] as string;
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) return [...prev.slice(0, -1), { role, text: last.text + delta }];
      return [...prev, { role, text: delta }];
    });
  }

  const voice = useLiveVoice({ url: `/api/live?token=${encodeURIComponent(token)}`, onEvent });
  const idle = voice.status === "idle" || voice.status === "closed";
  const live = voice.status === "connected";
  const compact = lines.length > 0 || artifacts.length > 0 || shared.length > 0;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [lines, artifacts, shared]);

  function share(payload: { text?: string; image?: string; name?: string }) {
    if (!live) {
      toast.error("Start talking first, then share.");
      return false;
    }
    if (!voice.sendContext(payload)) {
      toast.error("Couldn't send that — try again.");
      return false;
    }
    setShared((prev) => [...prev, { id: ++idRef.current, ...payload, pending: true }]);
    return true;
  }

  async function addImages(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (fileRef.current) fileRef.current.value = "";
    for (const f of files.slice(0, 4)) {
      try {
        share({ image: await shrinkImage(f), name: f.name });
      } catch {
        toast.error(`${f.name} couldn't be opened as a picture.`);
      }
    }
  }

  function sendDraft() {
    const t = draft.trim();
    if (!t) return;
    if (share({ text: t })) setDraft("");
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:px-6">
        <MobileMenuButton />
        <h1 className="text-sm font-medium">Voice</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className={cn("mx-auto flex w-full max-w-2xl flex-col items-center px-4", compact ? "gap-4 py-4" : "min-h-full justify-center gap-8 py-8")}>
          <div className={cn("relative flex items-center justify-center transition-all", compact ? "size-28" : "size-48")}>
            <div className={cn("absolute inset-0 rounded-full bg-star/20 blur-2xl transition-opacity", live ? "animate-pulse opacity-100" : "opacity-40")} />
            <div className={cn("relative rounded-full bg-gradient-to-br from-star to-star/40 shadow-[0_0_60px_-10px_var(--star)] transition-transform duration-700",
              compact ? "size-20" : "size-36",
              live && !voice.muted && "scale-110 animate-pulse", voice.status === "connecting" && "animate-spin")} />
          </div>
          <p role="status" className="text-sm text-muted-foreground">
            {idle && (voice.hasConnected ? "Call ended" : "Tap to start talking with Astra")}
            {voice.status === "connecting" && "Connecting…"}
            {live && (working ? "Astra is working on it…" : voice.muted ? "Muted" : "Listening — just talk")}
            {voice.status === "stopping" && "Ending…"}
          </p>
          {voice.error && <p role="alert" className="max-w-md text-center text-sm text-destructive">{voice.error}</p>}
          <div className="flex items-center gap-4">
            {idle ? (
              <button onClick={() => { setLines([]); setArtifacts([]); setShared([]); voice.start(); }} disabled={!token}
                className="flex items-center gap-2 rounded-full bg-star px-6 py-3 font-medium text-star-foreground disabled:opacity-40">
                <Mic className="size-5" /> Start talking
              </button>
            ) : (
              <>
                <button onClick={() => voice.setMuted(!voice.muted)} disabled={!live} aria-label={voice.muted ? "Unmute" : "Mute"}
                  className="flex size-14 items-center justify-center rounded-full border bg-card disabled:opacity-40">
                  {voice.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                </button>
                <button onClick={voice.stop} disabled={voice.status === "stopping"} aria-label="End call"
                  className="flex size-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                  <PhoneOff className="size-5" />
                </button>
              </>
            )}
            {voice.playbackBlocked && (
              <button onClick={voice.resumePlayback} className="flex items-center gap-2 rounded-full border px-4 py-3 text-sm"><Play className="size-4" /> Play voice</button>
            )}
          </div>

          {lines.length > 0 && (
            <div className="max-h-48 w-full space-y-2 overflow-y-auto rounded-lg border bg-card/60 p-3 text-sm">
              {lines.map((l, i) => (
                <p key={i} className={l.role === "user" ? "text-muted-foreground" : ""}><span className="font-medium">{l.role === "user" ? "You" : "Astra"}:</span> {l.text}</p>
              ))}
            </div>
          )}

          {shared.length > 0 && (
            <div className="flex w-full flex-wrap justify-end gap-2">
              {shared.map((s) => (
                <div key={s.id} className="flex max-w-[85%] items-center gap-2 rounded-lg bg-bubble px-3 py-2 text-sm text-bubble-foreground">
                  {s.image && <img src={s.image} alt={s.name ?? "shared"} className="size-12 rounded-md object-cover" />}
                  {s.text && <span className="break-all">{s.text}</span>}
                  {s.pending && <Loader2 className="size-3.5 shrink-0 animate-spin" />}
                </div>
              ))}
            </div>
          )}

          {artifacts.length > 0 && (
            <div className="w-full space-y-3">
              {artifacts.map((a, i) => <ArtifactCard key={i} a={a} />)}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="shrink-0 border-t bg-background px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-lg border bg-card px-2 py-1.5 focus-within:border-ring/60">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addImages(e.target.files)} />
          <button onClick={() => fileRef.current?.click()} disabled={!live} aria-label="Share images"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40">
            <ImagePlus className="size-4" />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendDraft(); } }}
            placeholder={live ? "Paste a link or type to Astra…" : "Start talking to share links or images"}
            disabled={!live}
            className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          />
          <button onClick={sendDraft} disabled={!live || !draft.trim()} aria-label="Send to Astra"
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-star text-star-foreground disabled:opacity-35">
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </div>
      <audio ref={voice.audioRef} className="sr-only" />
    </div>
  );
}
