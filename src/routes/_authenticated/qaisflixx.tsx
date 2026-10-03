import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { MobileMenuButton } from "@/components/astra/AppShell";

const SITE = "/qf/";

export const Route = createFileRoute("/_authenticated/qaisflixx")({
  head: () => ({ meta: [{ title: "Qaisflixx — Astra" }] }),
  component: Qaisflixx,
});

function Qaisflixx() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [err, setErr] = useState("");
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    setStatus("loading");
    ref.current.src = `${SITE}?r=${n}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <MobileMenuButton />
        <span className="font-display text-lg">Qaisflixx</span>
        <span className="text-xs text-muted-foreground">via proxy</span>
        <button onClick={() => setN((x) => x + 1)} className="ml-auto rounded-md p-1.5 hover:bg-accent" aria-label="Reload"><RotateCw className="size-4" /></button>
      </header>
      <div className="relative flex-1">
        {status !== "ready" && (
          <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            {status === "loading" ? "Loading Qaisflixx…" : `Couldn't load: ${err}`}
          </div>
        )}
        <iframe ref={ref} onLoad={() => setStatus("ready")} onError={() => { setErr("network error"); setStatus("error"); }} title="Qaisflixx" className="size-full border-0 bg-background" allow="autoplay; fullscreen; encrypted-media" allowFullScreen />
      </div>
    </div>
  );
}
