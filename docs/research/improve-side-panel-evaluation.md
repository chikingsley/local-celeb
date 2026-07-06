# Improve Side Panel Evaluation

Date: 2026-07-04

## Evidence Checked

Files reviewed:

- `improve-side-panel/package.json`
- `improve-side-panel/app/page.tsx`
- `improve-side-panel/components/header.tsx`
- `improve-side-panel/components/properties-panel.tsx`
- `improve-side-panel/components/sidebar-left.tsx`
- `improve-side-panel/components/editor.tsx`
- `improve-side-panel/components/timeline.tsx`
- `improve-side-panel/components/ui/resizable.tsx`

## Findings

- The prototype is a separate Next app with fake in-file sample data.
- It carries a large copied shadcn/Radix surface and older direct `@radix-ui/react-*` dependencies, while the main app now uses current Tailwind v4 shadcn/Base UI output.
- Its editor and timeline are older copies of the main app surfaces and do not include the new import adapters or derived Review/Cleanup mode work.
- The useful product ideas are layout-level, not implementation-level:
  - Header controls for panel visibility.
  - A collapsed right-panel rail concept.
  - A collapsed timeline mini-player concept.
  - Resizable panel handles from `react-resizable-panels`.

## Applied To Main App

- Added header controls for the right properties panel and bottom timeline.
- Added a collapsed timeline mini-player in the current Vite app.
- Replaced the main app's old custom left rail with a generated shadcn/Base UI sidebar shell.
- Kept the existing custom resize/store model instead of importing the prototype's Next/resizable-panel stack.

## Decision

Do not merge `improve-side-panel` wholesale. The useful ideas have been harvested into the main app. The remaining tree should be treated as archive/deletion candidate, not canonical product code.
