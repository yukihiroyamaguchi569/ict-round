# CLAUDE.md

# General Rule

1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

LLMs often pick an interpretation silently and run with it. This principle forces explicit reasoning:

State assumptions explicitly — If uncertain, ask rather than guess
Present multiple interpretations — Don't pick silently when ambiguity exists
Push back when warranted — If a simpler approach exists, say so
Stop when confused — Name what's unclear and ask for clarification
2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

Combat the tendency toward overengineering:

No features beyond what was asked
No abstractions for single-use code
No "flexibility" or "configurability" that wasn't requested
No error handling for impossible scenarios
If 200 lines could be 50, rewrite it
The test: Would a senior engineer say this is overcomplicated? If yes, simplify.

3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting
Don't refactor things that aren't broken
Match existing style, even if you'd do it differently
If you notice unrelated dead code, mention it — don't delete it
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused
Don't remove pre-existing dead code unless asked
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform imperative tasks into verifiable goals:

Instead of...	Transform to...
"Add validation"	"Write tests for invalid inputs, then make them pass"
"Fix the bug"	"Write a test that reproduces it, then make it pass"
"Refactor X"	"Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
Strong success criteria let the LLM loop independently. Weak criteria ("make it work") require constant clarification.







## Repo Summary

- This app's name is "めぐる君".
- This repository is a small client-side React + TypeScript + Vite app for hospital infection-control rounds.
- The app has no backend, API, auth, or database.
- The current flow is:
  1. Enter inspector name and optional ward name
  2. Rate checklist items by category
  3. Add photos either to a checklist item or as a general photo
  4. Write an overall evaluation
  5. Preview and export/share a `.docx` report
- GA4 usage statistics are kept in a Claude Artifact named "めぐる君 利用状況", not in this repository. Its URL is intentionally not recorded here because this repository is public and the link is shared only with core users; open it from the Artifact list instead. The numbers there are hardcoded and refreshed by hand.

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

## Important Current Behaviors
- Checklist results are initialized from `CHECKLIST_CATEGORIES` at round start.
- Each checklist item stores a rating plus zero or more linked photos.
- The app also supports general photos that are not linked to a checklist item.
- The overall evaluation is a free-text summary with optional speech input.
- Report export is currently `.docx`, not PDF.
- Theme selection uses `localStorage`.
- Round data itself is held in React state and is not persisted across reloads.
- Speech input depends on `SpeechRecognition` / `webkitSpeechRecognition`.

## File Structure
One line per file describing its role. When a PR adds, removes, or renames a file listed here, update this section in the same PR.

```text
src/
  main.tsx                 Entry point; initializes analytics and mounts App
  App.tsx                  Top-level screen switch (start / saved-rounds / round in progress); wires the hooks below to the screens, wraps ThemeProvider / IconProvider
  types.ts                 Shared types: Rating, checklist definitions, Photo, RoundData, SavedRound, RoundExport
  checklistData.ts         Built-in default checklist (CHECKLIST_CATEGORIES) and item lookup helpers
  checklistImport.ts       Parses user checklists from CSV / .xlsx; file type by extension, default name, SavedChecklist building
  localId.ts               newLocalId: local ID for photos and imported checklists (random + time, base 36)
  checklistStorage.ts      localStorage I/O: checklist library, active checklist ID, saved rounds
  roundDirty.ts            Unsaved-change detection via round snapshots
  roundData.ts             Pure round updates (start, rating, photos, evaluation, participant name), Photo and SavedRound building and the save-error message
  photoImage.ts            Photo file size limit, scaled size, and canvas shrinking with the EXIF orientation applied (compressImage)
  localDate.ts             Device-local YYYY-MM-DD date for report file names and share text
  whatsNew.ts              Picks unseen releases from public/updates/releases.json and persists the last seen version
  docx.ts                  Builds the report .docx from per-section builders (cover, checklist table, photos, evaluation) and shared docx helpers
  roundExportDocx.ts       Embeds / extracts round data (RoundExport) as a customXml part of the report .docx
  themes.ts                Theme definitions (warm / minimal / medical) and localStorage persistence
  ThemeContext.tsx         React context providing the current theme
  icons.ts                 App icon definitions (ran / meguru) and localStorage persistence
  IconContext.tsx          React context providing the current icon
  analytics.ts             GA4 initialization and trackEvent (never sends round input data)
  usePwaInstall.ts         Hook detecting PWA install availability (prompt / iOS manual)
  useInstallBanner.ts      Hook for the install banner: prompt vs iOS steps, hiding after acceptance or dismissal, and the analytics events
  useReportFile.ts         Hook pre-building the report .docx with embedded round data, share / download; buildRoundExport and reportFileName pure helpers
  useRound.ts              Hook for the round in progress: round data and its updates, start / resume / save, unsaved-change check, participant name carried to the next start
  useSavedRounds.ts        Hook for saved rounds in localStorage: list, save (upsert), delete
  useChecklistLibrary.ts   Hook for the checklist library and the active checklist, synced with localStorage
  useWhatsNew.ts           Hook fetching unseen release notes once at launch and recording them as seen on close
  usePhotoDraft.ts         Hook for the photo being added: pick, shrink, comment, and hand the built Photo to onAdd
  useChecklistImport.ts    Hook reading a chosen CSV / .xlsx into a preview and saving it as a new checklist
  index.css                Tailwind entry, theme CSS variables, utility classes, animations
  vite-env.d.ts            Vite type references
  components/
    StartScreen.tsx        Start screen with the "what's new" dialog over it (keeps the start screen inert while open)
    RoundStart.tsx         Start screen: inspector / ward name, checklist select / import / delete, links to saved rounds and the merge page
    SavedRoundsList.tsx    List of saved rounds to reopen or delete
    ChecklistImportDialog.tsx  Dialog to import a checklist file into the library
    ThemeSelector.tsx      Theme and icon picker (shown on the start screen)
    InstallBanner.tsx      PWA install prompt banner
    RoundScreens.tsx       Screens of a round in progress: main screen, add-photo, report, leave confirmation; mounted fresh per round
    MainScreen.tsx         Main screen shell: header, body of the active tab, bottom tab bar
    MainHeader.tsx         Main screen header: home button, participant name inline edit, progress badge, save button with feedback, theme picker
    BottomTabBar.tsx       Bottom tabs (checklist / photos / evaluation) and report button
    ChecklistTab.tsx       Checklist tab: categories with rating controls
    CategoryAccordion.tsx  One collapsible checklist category
    RatingButtons.tsx      A / B / C rating buttons for one item
    PhotoTab.tsx           Photo tab: item-linked and general photos
    PhotoForm.tsx          Add-photo screen: capture / gallery buttons, preview, linked item, comment (logic in usePhotoDraft)
    EvaluationTab.tsx      Overall evaluation free-text input
    LeaveRoundDialog.tsx   Confirm save / discard when leaving a round with unsaved changes
    WhatsNewDialog.tsx     "What's new" dialog shown on the start screen after an app update
    ReportPreview.tsx      Report screen shell: back button, export button and notices, preview; composes the parts below
    ReportExport.tsx       Share / Word export button and the build-failure / share-failure notices
    ReportDocument.tsx     On-screen report preview: title, meta, checklist table, photos, evaluation
  merge/                   Merge page (merge.html) that combines reports from several departments; runs on a PC, no localStorage
    main.tsx               Entry point; mounts MergeApp
    MergeApp.tsx           Merge page shell: header, load errors, warnings; composes the parts below
    useMergeFiles.ts       Hook for loaded reports (load / reorder / remove), load errors, merge result and merged .docx download; moveItem pure helper
    DropZone.tsx           Drop area and file picker for report .docx files
    LoadedFileList.tsx     Loaded reports with counts, reorder / remove buttons (order = column order)
    MergePreview.tsx       Merged rating table preview, Word export button and export error
    loadRoundFile.ts       Reads one report .docx (size limit, ZIP signature check) and extracts its round data
    mergeRounds.ts         Validates RoundExport and merges reports into department columns keyed by checklist item
    mergedDocx.ts          Builds the merged landscape .docx (item x department rating table, then evaluations and photos per department)
    mergedTableWidths.ts   Column width constants of the merged table and the readable department limit (shared by mergedDocx and mergeRounds)
  __tests__/               Vitest tests: logic *.test.ts in node (setup.ts: in-memory localStorage), components/*.test.tsx in jsdom via Testing Library (setup.jsdom.ts; the App*.test.tsx files share components/appTestHelpers.tsx and stub the add-photo / report screens with components/appStubs.tsx); fixtures/ holds sample .xlsx, a tiny .jpg and roundDocx.ts (builds report .docx files with embedded round data)
merge.html                 HTML entry of the merge page (second Vite input in vite.config.ts)
e2e/                       Playwright E2E tests against the production build (helpers.ts holds the shared fixture: suppresses the what's-new dialog / PWA banner, forces the download path, blocks external requests)
playwright.config.ts       Playwright config: Chromium only, serves `npm run build && npm run preview` on port 4317
stryker.config.json        Stryker mutation testing config (targets the core logic modules; report in reports/mutation/)
scoria.config.json         scoria code-health config (profile app, report mode); .scoria/baseline.json is the recorded baseline
scripts/build-docs.mjs     Converts the public docs (explicit list) to dist/docs/<slug>/index.html
public/
  sw.js                    Service Worker (offline support)
  manifest.json            PWA manifest
  about/                   Public landing page
  updates/                 Update history page; releases.json is its data
  round-checklist-template.xlsx  Downloadable checklist template
docs/
  technical-spec.md, user-guide.md, privacy-policy.md  Published under /docs/<slug>
  other *.md               Internal notes (not published)
  reference/               Original checklist source spreadsheets
.github/workflows/         ci.yml (lint / test / build, plus an e2e job), deploy.yml (GitHub Pages), mutation.yml (manual Stryker run, uploads the report), scoria.yml (scoria on every PR / main push; SARIF to code scanning), claude.yml
```

## Task Routing
- If the task is about screen flow, start in `src/App.tsx` and `src/components/RoundScreens.tsx`.
- If the task is about checklist categories or scoring coverage, start in `src/checklistData.ts` and `src/types.ts`.
- If the task is about checklist UI behavior, start in `src/components/MainScreen.tsx` and `src/components/ChecklistTab.tsx`.
- If the task is about adding, deleting, or labeling photos, start in `src/components/PhotoForm.tsx` and `src/components/PhotoTab.tsx`.
- If the task is about the final report, start in `src/components/ReportPreview.tsx`.
- If the task is about theme, colors, or labels, start in `src/themes.ts` and `src/ThemeContext.tsx`.

## Ignore By Default
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

## Versioning Policy
- When creating a PR that includes a new feature or bug fix, always bump the version in `package.json` and `package-lock.json` as part of the same PR.
- Use semantic versioning: new feature → minor (e.g. 1.1.0 → 1.2.0), bug fix → patch (e.g. 1.2.0 → 1.2.1).
- Bump major (e.g. 1.x → 2.0.0) only when compatibility breaks. The number of minor releases alone is never a reason; 1.20 or 1.35 is fine. A major bump is warranted when any of these holds:
  - Saved data in `localStorage` (saved rounds, checklist library) can no longer be read as-is and needs migration.
  - The round data embedded in the exported `.docx` changes incompatibly, so reports from different versions cannot be merged and users must all update.
  - A feature people use is removed.
  - A premise the public docs promise changes, e.g. adding a server so round input data leaves the device. This forces hospitals to redo their security review.
- Do not create a separate PR just for a version bump.

## Documentation Policy
- When a PR adds, changes, or removes a feature, update the affected documents in the same PR. Do not defer it to a follow-up PR.
- Which document to update:
  - What the user sees or operates changes → `docs/user-guide.md`
  - Screen structure, data model, storage, external communication, or dependencies change → `docs/technical-spec.md`
  - What is stored or transmitted changes → `docs/privacy-policy.md`
  - The public landing page would contradict the app → `public/about/index.html`
  - A version bump ships a change users can notice → `public/updates/releases.json`
- `public/updates/releases.json` is the update history rendered on `/updates`. Add an entry (`version`, `date`, `changes`) in the same PR as the version bump, written from the user's point of view. Internal-only bumps (refactoring, analytics, documentation) need no entry.
- When updating a document, also update its header: `最終更新日` and `対象バージョン` for the user guide and technical spec, or the `改定履歴` table for the privacy policy.
- **When removing a feature, grep the docs for its keywords and delete every stale mention.** Removing an implementation while leaving its description behind is how the docs drifted before (`SpeechRecognition` was removed in v1.7.6 but stayed documented in 6 places).
- If a change genuinely needs no documentation update, say so in the PR and why.
- `docs/technical-spec.md`, `docs/user-guide.md`, and `docs/privacy-policy.md` are **published as public web pages** under `/docs/<slug>`, generated from the Markdown at build time by `scripts/build-docs.mjs`. Write them for an outside reader — a hospital's security review is a real audience. Never put internal notes, credentials, or non-public information in these three files. Statements already published elsewhere (for example a roadmap answer in the landing page FAQ) are fine; keep them consistent with that source rather than removing them. Other files under `docs/` are internal and are not published; publishing is controlled by the explicit list in that script.





