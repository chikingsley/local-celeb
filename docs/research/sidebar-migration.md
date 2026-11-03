# Sidebar Migration Notes

Date: 2026-07-06

Status note, 2026-07-11: the local-library ideas below are historical migration context, not the active product direction. The canonical sidebar now exposes a manifest-driven list of bundled samples plus transcript/media import. Local project creation, recents, rename, removal, and indexed-library work are intentionally out of scope.

## Evidence Checked

Official docs:

- <https://ui.shadcn.com/docs/components/base/sidebar>
- <https://ui.shadcn.com/blocks/sidebar>
- <https://ui.shadcn.com/docs/changelog>
- <https://ui.shadcn.com/docs/components-json>
- <https://base-ui.com/react/overview/quick-start>

Local files:

- `components.json`
- `src/components/Sidebar.tsx`
- `src/app/app-sidebar.tsx`
- `src/components/ui/sidebar.tsx`
- `src/App.tsx`
- `src/stores/project-store.ts`
- `src/stores/player-store.ts`
- `improve-side-panel/components/ui/sidebar.tsx`
- `improve-side-panel/components/sidebar-left.tsx`

## Previous Local State

- The previous left sidebar was a custom rail in `src/components/Sidebar.tsx`.
- It is only navigation chrome. It does not model projects, files, recents, file actions, or selected-file state.
- `improve-side-panel` has a copied shadcn sidebar component and a fake left sidebar, but it is a separate Next prototype with stale sample data.
- The app used `components.json` with `style: "new-york"` and the aggregate `radix-ui` package.

## Official Direction

- The shadcn sidebar is a composable shell built around `SidebarProvider`, `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarHeader`, `SidebarFooter`, `SidebarInset`, and `SidebarTrigger`.
- shadcn sidebar blocks are intended as copy-in patterns, not installed libraries.
- shadcn now defaults new projects to Base UI. Base components use `@base-ui/react` and the `render` API rather than Radix `asChild`.
- `components.json` controls the generated component style. For this app, the migration target is the Base UI `base-nova` style.

## Migration Target

- `components.json`: switch to `base-nova`.
- `src/components/ui/sidebar.tsx`: use generated shadcn/Base UI sidebar primitive.
- `src/app/app-sidebar.tsx`: app-specific sidebar content and project/file rows.
- `src/app/app.tsx`: wrap the app shell with `SidebarProvider` and `SidebarInset`.
- `package.json`: use `@base-ui/react`; remove the aggregate `radix-ui` dependency once generated components are migrated.

## Implemented Shape

- Header: app identity button for `Local Celeb`.
- Workspace: `Home` and `Editor` navigation.
- Current File: active file row with transcript/speaker counts and export action.
- Samples: scar sample and retained multi-speaker speaker-repair fixture.
- Imports: transcript-only import and media-plus-subtitles import.
- Library: disabled placeholder until the local project/file model exists.
- Footer: fake local user menu with settings/export/sign-out shape.

## Historical Product Gap

The original migration left the following model decision open:

- what a project is,
- how transcript and media sidecars are stored,
- whether the app tracks recent files or a local library,
- how undo/redo and playback state attach to one open file,
- how rename/delete/import actions are represented.

The decision was later narrowed to bundled samples plus imports. The active backlog lives in `docs/TODO.md` and does not include a persistent local library.
