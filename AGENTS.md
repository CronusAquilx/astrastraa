<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All chat models resolve through `src/lib/astra/provider.server.ts` as OpenAI-compatible endpoints configured by env vars (default `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL`); never hard-code a model or use Lovable AI credits; there is no hosted fallback, and the default model is the homemade `builtin` provider (`src/lib/astra/mini-brain.ts`), handled directly in `/api/chat` with no AI call.
- Model registry and reasoning levels live in the database (`models`, `reasoning_levels`), so models are added by data, not code.
- Chat streaming goes through the `/api/chat` server route with the user's bearer token; messages persist server-side per thread, and the client sends only the latest message.
- Authenticated pages live under `src/routes/_authenticated/` with `ssr: false`, since the session lives in browser storage.
- Agent tools are defined in `src/lib/astra/tools.server.ts` and gated by rows in the `tools` table (enabled flag), so tools are switched on/off by data.
- The web proxy defaults to the Astra relay transport (`src/lib/astra/relay-transport.ts` → authenticated `/api/proxy` server route) so browsers only contact the app domain; Wisp transports (Epoxy/Libcurl) fall back to the relay when no Wisp server is reachable, because school/work networks block public Wisp hosts.
- Voice mode is fully on-device and free: Whisper (speech→text) and Kokoro (natural speech) via `src/hooks/use-free-voice.ts`, with replies from the same homemade brain, so voice never spends credits.
