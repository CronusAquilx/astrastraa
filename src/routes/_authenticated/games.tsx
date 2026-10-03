import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { MobileMenuButton } from "@/components/astra/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/games")({
  head: () => ({ meta: [{ title: "Games — Astra" }] }),
  component: Games,
});

const GAMES = ["Snake", "Tic-tac-toe", "2048"] as const;

function Games() {
  const [game, setGame] = useState<(typeof GAMES)[number]>("Snake");
  return (
    <div className="h-full overflow-y-auto">
      <header className="flex h-12 items-center px-3 md:hidden"><MobileMenuButton /></header>
      <div className="mx-auto max-w-xl px-4 py-8">
        <h1 className="font-display text-4xl">Games</h1>
        <div className="mt-4 flex gap-1.5">
          {GAMES.map((g) => (
            <button key={g} onClick={() => setGame(g)} className={cn("rounded-md border px-3 py-1.5 text-sm", game === g && "bg-accent")}>{g}</button>
          ))}
        </div>
        <div className="mt-6">{game === "Snake" ? <Snake /> : game === "Tic-tac-toe" ? <TicTacToe /> : <Game2048 />}</div>
      </div>
    </div>
  );
}

function Snake() {
  const N = 18;
  const [snake, setSnake] = useState([[9, 9]]);
  const [food, setFood] = useState([4, 4]);
  const [dead, setDead] = useState(false);
  const dir = useRef([1, 0]);
  const reset = () => { setSnake([[9, 9]]); setFood([4, 4]); dir.current = [1, 0]; setDead(false); };
  const turn = useCallback((d: number[]) => { if (d[0] !== -dir.current[0]! || d[1] !== -dir.current[1]!) dir.current = d; }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const m: Record<string, number[]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (m[e.key]) { e.preventDefault(); turn(m[e.key]!); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [turn]);
  useEffect(() => {
    if (dead) return;
    const t = setInterval(() => {
      setSnake((s) => {
        const h = [s[0]![0]! + dir.current[0]!, s[0]![1]! + dir.current[1]!];
        if (h[0]! < 0 || h[1]! < 0 || h[0]! >= N || h[1]! >= N || s.some((p) => p[0] === h[0] && p[1] === h[1])) { setDead(true); return s; }
        const ate = h[0] === food[0] && h[1] === food[1];
        if (ate) setFood([Math.floor(Math.random() * N), Math.floor(Math.random() * N)]);
        return [h, ...(ate ? s : s.slice(0, -1))];
      });
    }, 120);
    return () => clearInterval(t);
  }, [dead, food]);
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm"><span>Score {snake.length - 1}</span>{dead && <button onClick={reset} className="text-star">Game over — play again</button>}</div>
      <div className="grid aspect-square w-full rounded-md border" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
        {Array.from({ length: N * N }, (_, i) => {
          const x = i % N, y = Math.floor(i / N);
          const on = snake.some((p) => p[0] === x && p[1] === y);
          return <div key={i} className={on ? "bg-star" : food[0] === x && food[1] === y ? "rounded-full bg-destructive" : ""} />;
        })}
      </div>
      <div className="mx-auto mt-4 grid w-40 grid-cols-3 gap-1 md:hidden">
        {[["", null], ["↑", [0, -1]], ["", null], ["←", [-1, 0]], ["↓", [0, 1]], ["→", [1, 0]]].map(([l, d], i) =>
          d ? <button key={i} onClick={() => turn(d as number[])} className="rounded-md border py-2">{l as string}</button> : <span key={i} />)}
      </div>
    </div>
  );
}

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function TicTacToe() {
  const [b, setB] = useState<(string | null)[]>(Array(9).fill(null));
  const win = LINES.find(([a, c, d]) => b[a!] && b[a!] === b[c!] && b[a!] === b[d!]);
  const winner = win ? b[win[0]!] : null;
  const full = b.every(Boolean);
  function play(i: number) {
    if (b[i] || winner) return;
    const n = [...b]; n[i] = "X";
    const free = n.map((v, j) => (v ? -1 : j)).filter((j) => j >= 0);
    const won = LINES.some(([a, c, d]) => n[a!] === "X" && n[c!] === "X" && n[d!] === "X");
    if (!won && free.length) n[free[Math.floor(Math.random() * free.length)]!] = "O";
    setB(n);
  }
  return (
    <div>
      <p className="mb-2 text-sm">{winner ? `${winner} wins!` : full ? "Draw" : "You're X"} <button className="ml-2 text-star" onClick={() => setB(Array(9).fill(null))}>Reset</button></p>
      <div className="grid w-72 grid-cols-3 gap-1">
        {b.map((v, i) => <button key={i} onClick={() => play(i)} className="aspect-square rounded-md border text-4xl">{v}</button>)}
      </div>
    </div>
  );
}

function Game2048() {
  const fresh = () => add(add(Array(16).fill(0)));
  function add(g: number[]) { const e = g.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0); if (!e.length) return g; const n = [...g]; n[e[Math.floor(Math.random() * e.length)]!] = Math.random() < 0.9 ? 2 : 4; return n; }
  const [g, setG] = useState<number[]>(fresh);
  const move = useCallback((dir: "l" | "r" | "u" | "d") => {
    setG((g) => {
      const n = [...g];
      for (let k = 0; k < 4; k++) {
        const idx = [0, 1, 2, 3].map((j) => (dir === "l" ? k * 4 + j : dir === "r" ? k * 4 + 3 - j : dir === "u" ? j * 4 + k : (3 - j) * 4 + k));
        const row = idx.map((i) => n[i]!).filter(Boolean);
        for (let j = 0; j < row.length - 1; j++) if (row[j] === row[j + 1]) { row[j]! *= 2; row.splice(j + 1, 1); }
        idx.forEach((i, j) => (n[i] = row[j] ?? 0));
      }
      return n.join() === g.join() ? g : add(n);
    });
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const m: Record<string, "l" | "r" | "u" | "d"> = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d" };
      if (m[e.key]) { e.preventDefault(); move(m[e.key]!); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [move]);
  const start = useRef<[number, number] | null>(null);
  return (
    <div>
      <p className="mb-2 text-sm">Score {g.reduce((a, b) => a + b, 0)} <button className="ml-2 text-star" onClick={() => setG(fresh())}>New game</button></p>
      <div className="grid w-72 touch-none grid-cols-4 gap-1.5 rounded-md border p-1.5"
        onTouchStart={(e) => (start.current = [e.touches[0]!.clientX, e.touches[0]!.clientY])}
        onTouchEnd={(e) => { if (!start.current) return; const dx = e.changedTouches[0]!.clientX - start.current[0], dy = e.changedTouches[0]!.clientY - start.current[1]; if (Math.max(Math.abs(dx), Math.abs(dy)) > 25) move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : dy > 0 ? "d" : "u"); }}>
        {g.map((v, i) => <div key={i} className={cn("flex aspect-square items-center justify-center rounded text-lg font-medium", v ? "bg-star text-star-foreground" : "bg-muted")} style={v ? { opacity: 0.45 + Math.min(Math.log2(v), 11) * 0.05 } : undefined}>{v || ""}</div>)}
      </div>
    </div>
  );
}
