# CLAUDE.md

## Repo Summary
- This repository is a small client-side React + TypeScript + Vite app for hospital infection-control rounds.
- The app has no backend, API, auth, or database.
- The current flow is:
  1. Enter inspector name and optional ward name
  2. Rate checklist items by category
  3. Add photos either to a checklist item or as a general photo
  4. Write an overall evaluation
  5. Preview and export/share a `.docx` report

## Planning Policy
- When asked for a plan, do not read the whole repository.
- Start with a shallow scan only:
  - `package.json`
  - `src/App.tsx`
  - `src/types.ts`
  - `src/checklistData.ts`
  - `src/components/MainScreen.tsx`
- Then inspect only the files directly related to the task.
- Prefer a short tentative plan with assumptions over exhaustive reading.
- Expand investigation only after identifying the likely files to change.

## Source Of Truth
- Treat current implementation in `src/` as the primary source of truth.
- Treat `src/checklistData.ts` as the canonical checklist definition.
- Treat `README.md` as helpful but potentially stale.
- Treat `docs/` as supporting context only; do not assume it matches the current implementation.
- If `README.md` or `docs/` conflicts with `src/`, trust `src/`.

## App Structure
- App state and screen transitions:
  - `src/App.tsx`
- Shared data model:
  - `src/types.ts`
- Checklist master data and item lookup:
  - `src/checklistData.ts`
- Start screen:
  - `src/components/RoundStart.tsx`
- Main tab container and progress summary:
  - `src/components/MainScreen.tsx`
  - `src/components/BottomTabBar.tsx`
- Checklist rating flow:
  - `src/components/ChecklistTab.tsx`
  - `src/components/CategoryAccordion.tsx`
  - `src/components/RatingButtons.tsx`
- Photo capture and photo lists:
  - `src/components/PhotoForm.tsx`
  - `src/components/PhotoTab.tsx`
- Overall evaluation input:
  - `src/components/EvaluationTab.tsx`
- Report preview and `.docx` generation:
  - `src/components/ReportPreview.tsx`
- Theme selection and persistence:
  - `src/ThemeContext.tsx`
  - `src/themes.ts`
  - `src/components/ThemeSelector.tsx`
- Global styling:
  - `src/index.css`

## Important Current Behaviors
- Checklist results are initialized from `CHECKLIST_CATEGORIES` at round start.
- Each checklist item stores a rating plus zero or more linked photos.
- The app also supports general photos that are not linked to a checklist item.
- The overall evaluation is a free-text summary with optional speech input.
- Report export is currently `.docx`, not PDF.
- Theme selection uses `localStorage`.
- Round data itself is held in React state and is not persisted across reloads.
- Speech input depends on `SpeechRecognition` / `webkitSpeechRecognition`.

## Task Routing
- If the task is about screen flow, start in `src/App.tsx`.
- If the task is about checklist categories or scoring coverage, start in `src/checklistData.ts` and `src/types.ts`.
- If the task is about checklist UI behavior, start in `src/components/MainScreen.tsx` and `src/components/ChecklistTab.tsx`.
- If the task is about adding, deleting, or labeling photos, start in `src/components/PhotoForm.tsx` and `src/components/PhotoTab.tsx`.
- If the task is about the final report, start in `src/components/ReportPreview.tsx`.
- If the task is about theme, colors, or labels, start in `src/themes.ts` and `src/ThemeContext.tsx`.

## Ignore By Default
- Do not scan these unless the task clearly requires them:
  - `node_modules/`
  - `dist/`
  - `.venv/`
  - lockfiles
  - generated build output
- Do not inspect `docs/reference/round-checklist.xlsx` unless the task is about the original checklist source.
- Do not inspect `public/` assets unless the task is about static assets or sharing UX.

## Working Style For This Repo
- Keep exploration proportional; this is a small codebase.
- For planning requests, provide:
  1. a brief understanding of the task
  2. the likely entry files only
  3. a step-by-step plan
  4. assumptions or unknowns
- Avoid "read everything first" behavior.
