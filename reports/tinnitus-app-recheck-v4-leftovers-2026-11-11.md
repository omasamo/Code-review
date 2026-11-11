# Tinnitus Tracker: re-check of the review v4 leftovers (main @ 17e7e20, 11 November 2026)

Checked: `kamil12345/tinnitus-app` `main` @ `17e7e20` — merge of `fix/review-v4-leftovers-2026-11-11` (one commit, 972c758, 52 files, +501 / −602) on top of ab20712, landed at the owner's request the same evening as the first fix round. Scope given by the owner: fix everything still reasonable to fix, leave the onboarding PNGs (A155).

**How this was checked.** Each fix was verified in the merged tree by reading the changed lines and by grep (no default export left outside screens under `app/`, no ALL-CAPS section label in any of the 28 locale files, no literal `" to "` in the interval text, `AGENTS.md` absent, `textTransform` on the three screens, the clamp in `EntryForm.handleSave`). Automated: `tsc --noEmit` 0 errors; `npm test` 6/6 PASS (two suites added); `test:calibration` PASS.

## Result

| Verdict | Count |
|---|---|
| Fixed at this commit | 11 |
| Open with a new note | 12 |
| Open, unchanged (human / owner / deferred) | 15 |

Dashboard: 27 open / 208 fixed.

## What could not be done

- **CI workflow (A89)** — `.github/workflows/ci.yml` (npm ci → typecheck → npm test → test:calibration on push to main and pull requests) was written and committed, but GitHub rejected the push: the Mac's `gh` OAuth token has no `workflow` scope. The file was removed from the merge; it needs to be added from a token with that scope (`gh auth refresh -s workflow`, then commit the file).
- **Migration tests (A85)** — `ensureColumn`, `splitPulsatileThrummingType`, `cleanOrphanedLinks` need a SQLite runtime under Node; the date maths and import validation are tested.
- **Onboarding PNGs (A155)** — left as they are, owner's request.

## Fixed

| ID | Severity | Finding | How |
|---|---|---|---|
| A22 | medium | CNG workflow with a stale local android/ folder: `run:android` silently builds without six config plugins | Fixed: CLAUDE.md commands + README now say `npx expo prebuild --clean --platform android` is required after native dep / plugin / firebase.json changes, and why run:android alone is not enough. |
| A27 | medium | app/ vs src/features boundary is bidirectional, and non-route modules under app/ are registered as navigable routes | Fixed: app/db/database.ts exports `{ db }` and app/i18n/index.ts exports `{ i18n }` (named); no file outside screens under app/ has a default export, so /db/database and /i18n are no longer routes. (The app/ ↔ src/features import direction is unchanged and tracked under A95.) |
| A73 | medium | Shared dialogs hard-code "Cancel", "Delete" and "OK" instead of using the existing common.* keys | Fixed: The iOS share-sheet title uses t('myData.exportData') (my-data.tsx:270); ConfirmDialog/StatusDialog were already translated. |
| A86 | medium | fitTemporalProfile and the suspectReverse heuristic have no test; the existing test scripts are not runnable from the repo and never cover the shipped aggregation | Fixed: tests/stats/temporalProfile.validation.ts covers fitTemporalProfile (carry-over lands on the lag term, confounder → suspectReverse, streak counts below the minimum, non-adjacent days give no lag estimate); in npm test. |
| A116 | low | AGENTS.md is a stale August snapshot committed in October and contradicts CLAUDE.md | Fixed: AGENTS.md deleted (git rm at 972c758). |
| A117 | low | AGENTS.md is a stale fork of CLAUDE.md with contradicting guidance; CLAUDE.md itself misstates the intensity scale | Fixed: See A116. |
| A140 | low | Back-dated entries get the current wall-clock time, and today's entries can be timestamped in the future | Fixed: app/entry/new.tsx:26 starts a back-dated Calendar entry at 12:00 (today keeps the current time); EntryForm.handleSave clamps the combined timestamp to now (EntryForm.tsx:411-414). |
| A148 | low | Section labels are shouted in the JSON for some screens and uppercased via style on others, forcing translators to choose casing | Fixed: more.personalSection/insightsSection/supportSection, profile.personalInfoSection and myData.manageDataSection are sentence case in all 28 locales; more.tsx, profile.tsx and my-data.tsx uppercase via textTransform like settings.tsx. |
| S28 | high | Intensity is never announced to screen readers: IntensityIcon, entry rows, calendar cells and stat tiles carry no label | Fixed: Stats overview tiles take accessibilityLabel (StatTile.tsx) — Avg announces level name + value, Change the signed levels, Entries the count and days (trends.tsx). |
| S39 | low | Trigger Impact interval text hard-codes the English word "to" between the two bounds | Fixed: stats.trigger.range ("{{low}} to {{high}}", translated in 28 locales) replaces the literal " to " (TriggerImpactCard.tsx:29-33). |
| S40 | low | formatSigned prints "−0.0"/"+0.0" for values that round to zero | Fixed: formatSigned signs the rounded value (format.ts:30-38): −0.04 → "0.0". |

## Open, with a note at this commit

| ID | Severity | Finding | Note |
|---|---|---|---|
| A52 | medium | iOS export leaves the full-diary JSON in the cache forever and records 'export completed' even when the user cancels | Partly fixed: Unchanged at 17e7e20 (expo-sharing limitation). |
| A54 | medium | PDF is deleted the instant the Android chooser returns, before the receiving app has necessarily read it | Partly fixed: Unchanged at 17e7e20. |
| A55 | medium | Report PDF is deleted the instant the Android share chooser hands off, before the target app has read it; cancel still counts as shared | Partly fixed: Unchanged at 17e7e20. |
| A56 | medium | hexToRgba copied 23 times, makeStyles boilerplate 38 times, back-button header and modal shells duplicated per file | Partly fixed: Unchanged at 17e7e20: back-button header still repeated per screen. |
| A78 | medium | Support-directory country names are always English because Intl.DisplayNames is unavailable on Hermes | Partly fixed: Unchanged at 17e7e20. |
| A85 | medium | Highest-risk logic (schema migration/backfill, local-day date math, import/export) has zero tests | Partly fixed: tests/utils/datetime.validation.ts now covers formatDateKey/computeLocalDate/wallClockIn/fromWallClock/combineDateTime/toZonedDisplayDate incl. DST gap and repeated hour (helpers moved to app/utils/timeZone.ts to run under Node); import validation was already tested. The SQLite migrations (ensureColumn, splitPulsatileThrummingType, cleanOrphanedLinks) remain untested — they need a SQLite runtime in Node. |
| A89 | medium | No typecheck, lint or format gate; `tsc` passes today but nothing enforces it | Still open: typecheck/test scripts and now 6 suites exist. A GitHub Actions workflow (npm ci → typecheck → npm test → test:calibration) was written on the fix branch but the push was rejected: the Mac's gh token has no `workflow` scope. Needs a token with that scope; no ESLint config yet. |
| A92 | medium | Fixed-height text boxes and 9–10pt type break under OS font scaling; no font-scaling strategy exists | Partly fixed: Unchanged at 17e7e20. |
| A120 | low | Future-day toast timer is never assigned, and rapid taps overlap two Animated sequences; month navigation also double-fetches entries | Partly fixed: Unchanged at 17e7e20. |
| A155 | low | Three 1 MB onboarding PNGs account for ~3 MB of the app for illustrations shown once | Still open: Left as is on 2026-11-11 at the owner's request (800 px PNGs, ~3.6 MB). |
| A158 | low | iOS export and import leave health-data copies in the cache directory, and iOS export is recorded as completed even if the share sheet is cancelled | Partly fixed: Unchanged at 17e7e20. |
| A173 | low | Reminder is enabled and scheduled before the permission prompt; a denial leaves the switch on with nothing that can fire | Partly fixed: Unchanged at 17e7e20. |

## Open, unchanged

A65, A66, A95, A97, A141, A145, A154, A170, L1, L9, L10, S7, S14, S31, S36 — privacy policy page (L1), paywall template (L10), clinician sign-off (S7), npm audit (S31), store build (S36), remote-config kept (S14), and the owner decisions / deferred refactors (A65, A66, A95, A97, A141, A145, A154, A170, L9).
