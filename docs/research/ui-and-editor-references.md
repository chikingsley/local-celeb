# UI And Editor References

Date: 2026-07-04

## shadcn/ui

Sources:

- https://ui.shadcn.com/docs/installation/vite
- https://ui.shadcn.com/docs/tailwind-v4
- https://ui.shadcn.com/docs/cli

Findings:

- The current shadcn Vite path is Tailwind v4 and React 19.
- Current component output uses the aggregate `radix-ui` package.
- Current component output uses `data-slot` attributes and no `forwardRef` wrapper.
- `toast` is deprecated in favor of `sonner`; this app does not currently use shadcn toast.
- The CLI supports `info`, `add --dry-run`, and `--diff`, which is the right way to audit local component drift.

Applied here:

- Ran `shadcn info`; the main app is recognized as Vite, Tailwind v4, React, TypeScript, `new-york`, `radix`, and lucide.
- Updated the installed shadcn UI files: `button`, `select`, `slider`, and `tooltip`.
- Switched from direct `@radix-ui/react-*` dependencies to the current `radix-ui` aggregate dependency.
- Wrapped the app in `TooltipProvider`.

## Transcript Editor Patterns

Sources:

- https://github.com/bbc/react-transcript-editor
- https://github.com/bbc/react-transcript-editor/blob/master/docs/features-list.md
- https://github.com/bbc/react-transcript-editor/blob/master/docs/guides/adapters.md
- https://pietropassarelli.net/react-slate-transcript-editor.html

Findings:

- BBC React Transcript Editor's useful architecture lesson is adapter-first import/export support across provider formats, not its old Draft.js stack.
- BBC's listed adapter targets include SRT, VTT, TTML, Gentle, AssemblyAI, Rev, Speechmatics, AWS, Watson, and 3Play.
- The adapter guide frames import adapters as the boundary that converts STT provider data into the editor's internal timed-text model.
- Slate Transcript Editor was a later rewrite influenced by the BBC editor, with alignment treated as a separate domain dependency.

Applied here:

- Added `src/lib/transcript-import.ts` as the local adapter boundary.
- Implemented adapters for current Local Celeb JSON/Groq segments, Scribe/Superwhisper word-first JSON/JSONL shapes, provider turns, and SRT/VTT cues.
- Added `src/lib/transcript-turns.ts` as the derived turn boundary over the segment store.
- Review mode now renders speaker-change turns; Cleanup mode keeps the segment editor/timeline surface.
- Kept persisted editor state segment-based while deriving `Transcript -> Turn -> Segment -> Word` views from the evidence-backed model.
