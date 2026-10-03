import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Mic, PhoneOff } from "lucide-react";
import { useFreeVoice } from "@/hooks/use-free-voice";
import { MobileMenuButton } from "@/components/astra/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/voice")({
  head: () => ({
    meta: [
      { title: "Voice — Astra" },
      { name: "description", content: "Talk with Astra Mini out loud. Free, private, and running right inside Astra." },
    ],
  }),
  component: VoicePage,
});

function VoicePage() {
  const v = useFreeVoice();
  const endRef = useRef<HTMLDivElement>(null);
  const on = v.status !== "idle" && v.status !== "error";
  const compact = v.lines.length > 0;
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [v.lines]);

  const label = {
    idle: v.lines.length ? "Call ended" : "Tap to start talking with Astra",
    loading: v.progress || "Getting ready…",
    listening: "Listening — just talk",
    thinking: "Thinking…",
    speaking: "Astra is talking…",
    error: "",
  }[v.status];

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:px-6">
        <MobileMenuButton />
        <h1 className="text-sm font-medium">Voice</h1>
        <span className="ml-auto rounded-full border px-2 py-0.5 text-xs text-muted-foreground">Free · runs on your device</span>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className={cn("mx-auto flex w-full max-w-2xl flex-col items-center px-4", compact ? "gap-4 py-4" : "min-h-full justify-center gap-8 py-8")}>
          <div className={cn("relative flex items-center justify-center transition-all", compact ? "size-28" : "size-48")}>
            <div className={cn("absolute inset-0 rounded-full bg-star/20 blur-2xl transition-opacity", on ? "animate-pulse opacity-100" : "opacity-40")} />
            <div className={cn("relative rounded-full bg-gradient-to-br from-star to-star/40 shadow-[0_0_60px_-10px_var(--star)] transition-transform duration-700",
              compact ? "size-20" : "size-36",
              v.status === "speaking" && "scale-110 animate-pulse",
              v.status === "listening" && "scale-105",
              v.status === "loading" && "animate-spin")} />
          </div>
          <p role="status" className="text-center text-sm text-muted-foreground">{label}</p>
          {v.status === "loading" && !v.lines.length && (
            <p className="max-w-sm text-center text-xs text-muted-foreground">The first time takes a minute while Astra downloads its voice (about 150 MB). After that it starts fast.</p>
          )}
          {v.error && <p role="alert" className="max-w-md text-center text-sm text-destructive">{v.error}</p>}
          {on ? (
            <button onClick={v.stop} aria-label="End call" className="flex size-14 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
              <PhoneOff className="size-5" />
            </button>
          ) : (
            <button onClick={v.start} className="flex items-center gap-2 rounded-full bg-star px-6 py-3 font-medium text-star-foreground">
              <Mic className="size-5" /> Start talking
            </button>
          )}
          {v.lines.length > 0 && (
            <div className="w-full space-y-2 rounded-lg border bg-card/60 p-3 text-sm">
              {v.lines.map((l, i) => (
                <p key={i} className={l.role === "user" ? "text-muted-foreground" : ""}><span className="font-medium">{l.role === "user" ? "You" : "Astra"}:</span> {l.text}</p>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}
