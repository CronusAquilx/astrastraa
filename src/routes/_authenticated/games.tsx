import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { MobileMenuButton } from "@/components/astra/AppShell";
import { usePrefs } from "@/lib/astra/prefs";
import { openProxied } from "@/lib/astra/proxy";

export const Route = createFileRoute("/_authenticated/games")({
  head: () => ({ meta: [{ title: "Games — Astra" }] }),
  component: Games,
});

const SERVERS = [
  { name: "GN Math", url: "https://gn-math-t.github.io/" },
  { name: "Lumin", url: "https://lumin-game.github.io/" },
  { name: "Cloud", url: "https://web.cloudmoonapp.com/" },
  { name: "Emulator", url: "https://demo.emulatorjs.org/" },
  { name: "Arcade", url: "https://www.crazygames.com/" },
  { name: "CKV", url: "https://wanocapy.github.io/ChickenKingsVault/" },
  { name: "Seraph", url: "https://seraph.reveriestudios.online/" },
  { name: "Truffled", url: "https://truffled.lol/" },
  { name: "UGS", url: "https://0288007.github.io/ugs/" },
] as const;

function Games() {
  const prefs = usePrefs();
  const ref = useRef<HTMLIFrameElement>(null);
  const [server, setServer] = useState<string>(() =>
    typeof window === "undefined" ? "GN Math" : localStorage.getItem("astra-game-server") || "GN Math");
  const [nonce, setNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const current = SERVERS.find((s) => s.name === server) ?? SERVERS[0];

  useEffect(() => {
    localStorage.setItem("astra-game-server", current.name);
    setError(null);
    if (ref.current) openProxied(ref.current, current.url, prefs).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.name, nonce, prefs.transport, prefs.wisp]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <MobileMenuButton />
        <h1 className="font-display text-xl">Games</h1>
        <select value={current.name} onChange={(e) => setServer(e.target.value)}
          className="ml-auto rounded-md border bg-background px-2 py-1 text-sm" aria-label="Server">
          {SERVERS.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
        <button onClick={() => setNonce((n) => n + 1)} className="rounded-md border p-1.5" aria-label="Reload"><RotateCw className="h-4 w-4" /></button>
      </header>
      {error && <p className="px-4 py-2 text-sm text-destructive">Couldn't load {current.name}: {error}. Try another server.</p>}
      <iframe key={`${current.name}-${nonce}`} ref={ref} title={current.name} className="w-full flex-1 border-0 bg-background" allow="fullscreen; autoplay; gamepad" />
    </div>
  );
}
