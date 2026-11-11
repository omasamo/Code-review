# Tinnitus Tracker: re-check of the review v4 fix round (main @ ab20712, 11 November 2026)

Checked: `kamil12345/tinnitus-app` `main` @ `ab20712` — the merge of `fix/review-v4-2026-11-11` (6 commits on top of 3d06b05, 172 files, +7,085 / −4,843), landed on 11 November 2026 at the owner's request. Read-only from the review side; the fix branch itself was written in the same project earlier that day.

**How this was checked.** Every one of the 173 findings open at 3d06b05 was re-verified in the code of the branch (file and line opened, the claim tested), not from commit messages. Then a regression pass over the whole diff in six areas (data layer and migrations, startup/lifecycle/consent, entry form and settings screens, statistics maths and the split Stats screen, reports/PDF, i18n and native config) and a deeper read of every new file. `A#`/`L#`/`S#` are the dashboard ids; `S39`–`S40` are added at this commit.

## Automated checks

| Command | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | 0 errors |
| `npm test` (features, trigger model, import validation, i18n plurals) | 4/4 PASS |
| `npm run test:calibration` | PASS (now exits 1 on FAIL) |
| `npx expo config --type public` | OK |
| Literal `t('…')` keys used in app/ and src/ vs en.json | 499 used, 0 missing (plural bases resolved) |
| Locale parity (28 files, 13 pluralised keys, all CLDR categories) | PASS (tests/i18n/plurals.validation.ts) |

Not verified on a device or emulator.

## Result

| Verdict | Count |
|---|---|
| Fixed | 137 |
| Partly fixed (still open, note in history) | 17 |
| Still open, should have been covered by the branch | 4 |
| Human task / owner decision (unchanged) | 15 |
| New at this commit | 2 |

The dashboard now shows 38 open / 197 fixed.

## Regressions and things worth knowing

No hard regression was found in the diff. Notes:

1. **AGENTS.md was not deleted** although CLAUDE.md's 2026-11-11 session note says it was. It is now a copy of CLAUDE.md headed "guidance to Codex (claude.ai/code)" (A116/A117 partly fixed).
2. **Import dedupe** keys on `(created_at, intensity, note)` (queries.ts:365-385). Two genuinely different entries sharing the same millisecond, level and note would be merged; in practice that only happens with duplicated backups, which is the intent.
3. **Cancel on Triggers / Sound Types** now asks "Discard changes?" when toggles are pending (useDiscardGuard). This is what A67 asked for, but it is a visible behaviour change.
4. **`skipNextDiscardGuard()`** is a module-level flag (useDiscardGuard.ts:4-7). It is cleared by the next `beforeRemove`; if a delete ever failed to navigate, the next back on any guarded screen would pass without a prompt. Theoretical today.
5. **iOS export** still records `export_completed` / "Last exported" when the share sheet is dismissed — expo-sharing cannot tell save from dismiss; the code documents it (A52/A158 partly fixed).
6. **Native changes in this merge** (`app.json` userInterfaceStyle/supportsTablet/supportedLocales/blockedPermissions, `firebase.json` flags, `Snapshot.swift`) require a new store build before the next `eas update` (S36).

## New findings

| ID | Severity | Finding | What |
|---|---|---|---|
| S39 | low | Trigger Impact interval text hard-codes the English word "to" between the two bounds | levelRangeOf() returns `${formatSigned(low)} to ${formatSigned(high)}` with a literal " to " (TriggerImpactCard.tsx:26-28), used for the 95% interval line and the day-before/day-after tile ranges (:46-47, :61). The numbers are locale-formatted (A144) but the connector is English in all 27 other languages. Pre-dates the fix branch (trends.tsx:190 at 3d06b05) but was never recorded. |
| S40 | low | formatSigned prints "−0.0"/"+0.0" for values that round to zero | formatSigned() takes the sign from the unrounded value and the magnitude from formatNumber() (format.ts:30-35), so −0.04 becomes "−0.0" and +0.04 "+0.0". It replaced the toFixed-based caption that A102 flagged for the same reason ("-0%"), and is now used for the Change tiles on Home and Stats, every trigger effect, the interval bounds and the day-before/after tiles. |

## Still open, should have been fixed

| ID | Severity | Finding | Note |
|---|---|---|---|
| A22 | medium | CNG workflow with a stale local android/ folder: `run:android` silently builds without six config plugins | Still open: CLAUDE.md:9 and README.md:33 still present `npx expo run:android` as the native-rebuild step with no note that a stale local android/ folder skips prebuild. Nothing in the branch touched this. |
| A27 | medium | app/ vs src/features boundary is bidirectional, and non-route modules under app/ are registered as navigable routes | Still open: `export default db` (app/db/database.ts:312) and `export default i18n` (app/i18n/index.ts:78) remain, so expo-router still registers /db/database and /i18n as routes; the app/ ↔ src/features imports are still bidirectional. |
| A140 | low | Back-dated entries get the current wall-clock time, and today's entries can be timestamped in the future | Still open: app/entry/new.tsx:23 still initialises entryTime with `new Date()` for a back-dated calendar entry, and nothing bounds the combined timestamp against now (only the date picker has maximumDate, EntryForm.tsx:471/528). |
| A148 | low | Section labels are shouted in the JSON for some screens and uppercased via style on others, forcing translators to choose casing | Still open: more.personalSection/insightsSection/supportSection, profile.personalInfoSection and myData.manageDataSection are still ALL-CAPS in en.json while app/settings.tsx:365 uppercases via textTransform. |

## Partly fixed

| ID | Severity | Finding | Note |
|---|---|---|---|
| A52 | medium | iOS export leaves the full-diary JSON in the cache forever and records 'export completed' even when the user cancels | Partly fixed: The iOS backup JSON is now deleted in finally after the share sheet (my-data.tsx:266-274). last_exported_at and export_completed are still written when the sheet is dismissed — expo-sharing resolves identically for save and dismiss, which the code now documents (:275-278). |
| A54 | medium | PDF is deleted the instant the Android chooser returns, before the receiving app has necessarily read it | Partly fixed: On Android the PDF is deleted 60 s after the chooser returns, leftovers purged on the next report (reportExport.ts:41-60). A dismissed sheet is still logged (as report_created action: share_opened, so no longer counted as saved). |
| A55 | medium | Report PDF is deleted the instant the Android share chooser hands off, before the target app has read it; cancel still counts as shared | Partly fixed: See A54. |
| A56 | medium | hexToRgba copied 23 times, makeStyles boilerplate 38 times, back-button header and modal shells duplicated per file | Partly fixed: hexToRgba is gone (0 copies; withAlpha in theme.ts). The back-button header JSX and its styles are still repeated per sub-screen. |
| A73 | medium | Shared dialogs hard-code "Cancel", "Delete" and "OK" instead of using the existing common.* keys | Partly fixed: ConfirmDialog/StatusDialog use common.cancel/delete/ok. The iOS share-sheet `dialogTitle: 'Save Tinnitus Data'` (my-data.tsx:270) is still English. |
| A78 | medium | Support-directory country names are always English because Intl.DisplayNames is unavailable on Hermes | Partly fixed: Intl.DisplayNames is guarded (support-directory.tsx:21-27) so it can no longer throw, but on Hermes without a polyfill the country names still fall back to the English countryFallback. |
| A85 | medium | Highest-risk logic (schema migration/backfill, local-day date math, import/export) has zero tests | Partly fixed: npm test now runs 4 validation suites (features, trigger model, import validation, i18n plurals) + test:calibration. The migrations (ensureColumn, splitPulsatileThrummingType, cleanOrphanedLinks) and the local-day date math in app/utils/datetime.ts are still untested. |
| A86 | medium | fitTemporalProfile and the suspectReverse heuristic have no test; the existing test scripts are not runnable from the repo and never cover the shipped aggregation | Partly fixed: The test runner exists (tsx devDependency, npm test). fitTemporalProfile still has no test. |
| A89 | medium | No typecheck, lint or format gate; `tsc` passes today but nothing enforces it | Partly fixed: typecheck/test scripts exist; no ESLint/Prettier config and no CI workflow yet. |
| A92 | medium | Fixed-height text boxes and 9–10pt type break under OS font scaling; no font-scaling strategy exists | Partly fixed: height → minHeight on tiles, tab bar and calendar cells; maxFontSizeMultiplier on Home captions. No scaling strategy on the other screens. |
| A116 | low | AGENTS.md is a stale August snapshot committed in October and contradicts CLAUDE.md | Partly fixed: AGENTS.md was NOT deleted — CLAUDE.md's 2026-11-11 note says it was. It was rewritten as a copy of CLAUDE.md with the header "guidance to Codex (claude.ai/code)" and "machine-translated by Codex" (AGENTS.md:3, 173). Delete it or fix the header. |
| A117 | low | AGENTS.md is a stale fork of CLAUDE.md with contradicting guidance; CLAUDE.md itself misstates the intensity scale | Partly fixed: See A116 — content now matches CLAUDE.md, header still wrong, and CLAUDE.md claims the file is gone. |
| A120 | low | Future-day toast timer is never assigned, and rapid taps overlap two Animated sequences; month navigation also double-fetches entries | Partly fixed: The toast sequence is stopped before restarting (toastSeq ref, calendar.tsx:116) and the month arrows run one SELECT. The focus reset branch still calls getEntriesForMonth and the monthKey effect repeats it once. |
| A155 | low | Three 1 MB onboarding PNGs account for ~3 MB of the app for illustrations shown once | Partly fixed: The six onboarding PNGs are 800×800 at ~0.6 MB each (3.6 MB total, was 7 MB); still PNG, not WebP. |
| A158 | low | iOS export and import leave health-data copies in the cache directory, and iOS export is recorded as completed even if the share sheet is cancelled | Partly fixed: Export and import cache copies are deleted (my-data.tsx:266-274, 313-322); the iOS "exported on dismiss" part remains (see A52). |
| A173 | low | Reminder is enabled and scheduled before the permission prompt; a denial leaves the switch on with nothing that can fire | Partly fixed: After a grant the reminder is re-synced (reminders.tsx:72-79). On denial the switch stays on, but the "Notifications are off" banner with Allow/Open settings is shown. |
| S28 | high | Intensity is never announced to screen readers: IntensityIcon, entry rows, calendar cells and stat tiles carry no label | Partly fixed: IntensityIcon, entry rows, calendar cells and the Home tiles announce the level. The Stats overview tiles (app/components/stats/StatTile.tsx) still have no accessibilityLabel, so the Avg/Change level name is not announced there. |

## Human tasks and owner decisions (unchanged)

| ID | Severity | Finding | Note |
|---|---|---|---|
| L1 | critical | The live privacy policy does not describe the app that ships | Still open: Live page unchanged (Last updated 16.06.2026); needs the website edit, not a code change. |
| L10 | medium | Subscription terms live in the RevenueCat dashboard, not the repo | Still open: Dashboard-side check of the RevenueCat paywall template; not a code change. |
| S7 | medium | Learn is shown by default before independent clinician sign-off | Still open: Independent clinician / native-speaker sign-off is a human task; the review package was updated (S37). |
| S31 | low | npm audit: 35 vulnerabilities (15 high) in production dependencies, all transitive through Expo / apple-targets | Still open: All transitive through Expo / apple-targets; nothing to change in the app until Expo updates. |
| S36 | low | Native changes since 6be7c70 (RN 0.83.10, Expo 55.0.32, expo-font plugin, widget Kotlin/Swift) need a store build before the next eas update | Still open: The merge adds more native changes (app.json, firebase.json, Snapshot.swift) — a store build is required before the next eas update. |
| S14 | low | @react-native-firebase/remote-config is still installed after Remote Config was removed | Still open: Kept on purpose (owner's decision, CLAUDE.md 2026-10-17). |
| A65 | medium | Paywall is shown immediately after the disclaimer, before the user has logged anything, and the promo copy promises features that are not actually gated | Still open: Paywall still follows the consent step; owner's decision. |
| A141 | low | Onboarding requires a name before the app can be used, though the name only personalises the greeting | Still open: Name still required in onboarding; owner's decision. |
| A95 | low | No data-access layer: screens call SQLite directly in render/focus, duplicate derived facts, and pass state through a module-level global | Still open: Data-access layer refactor deferred. |
| A97 | low | Eight context providers re-implement the same get/setSetting boilerplate and nest eight deep | Still open: Shared persisted-setting hook deferred. |
| A170 | low | Layouts use physical left/right properties and unmirrored chevrons (RTL not ready for the planned Arabic) | Still open: No RTL locale shipped; deferred. |
| A145 | low | Serbian ships Latin-script only and is auto-selected for Cyrillic-script devices | Still open: Serbian Latin only; deferred. |
| A154 | low | All 28 locale JSON files are eagerly bundled into the JS bundle | Still open: Eager locale bundling kept on purpose. |
| A66 | medium | The ridge penalty and posterior variance use the marginal variance of intensity, not the residual variance, so the stated prior SD of 0.35 and the '95% range' describe a model that only runs when triggers explain nothing | Still open: Model internals unchanged; owner's decision. |
| L9 | medium | "Wellness, not health" is only partly true, and one planned feature would break it | Still open: Positioning question for the owner; copy fixes from S16/S17 reduce the exposure. |

## Fixed

| ID | Severity | Finding | How |
|---|---|---|---|
| A23 | medium | Stats screen is a 2,298-line god component whose memoisation is defeated by fresh i18n label arrays every render | Fixed: Label arrays are memoised on [t] (trends.tsx:204-216); the 13 dependent memos no longer recompute per tap. |
| A24 | medium | trends.tsx is a 2298-line screen that bundles pure statistics, generic chart components and a 500-line stylesheet; the model's day-aggregation is copied in three places | Fixed: trends.tsx is 542 lines; cards live in app/components/stats/*, pure code in app/stats/{composition,dayOfWeek,aggregate}.ts; buildModelDays is the single day-aggregation shared with reports and achievements. |
| A25 | medium | Anchor check-in / entry provenance machinery is dormant and half-wired | Fixed: Anchor check-in subsystem removed: prompts table dropped by removeAnchorPrompts(), queries/notification code and anchor.* strings gone; new entries write source=self_initiated. |
| A26 | medium | The anchor check-in subsystem is dead code: never started, never scheduled, never handled on tap | Fixed: See A25. |
| A28 | medium | userInterfaceStyle: 'light' locks iOS to light mode, so the 'Automatic' theme can never be dark on iOS | Fixed: app.json userInterfaceStyle is "automatic". |
| A29 | medium | iOS is forced to light mode, so Appearance → Automatic can never resolve to dark on iPhone/iPad | Fixed: See A28. |
| A30 | medium | `userInterfaceStyle: "light"` forces iOS to light appearance, so the app's own 'Automatic' theme can never resolve to dark on iOS | Fixed: See A28. |
| A32 | medium | Stats 'All' range is silently capped at the newest 1000 entries | Fixed: Stats loads by anchored local day: getEntriesSince(rangeLoadStartKey) for 7D/30D/90D, getAllEntries() for All (trends.tsx:157-170, queries.ts getEntriesSince/getAllEntries); CLAUDE.md updated. |
| A33 | medium | 'All' range is silently capped at the 1000 most recent entries; the header date range, 'of N days' tile, monthly buckets and the model all treat that subset as the whole diary | Fixed: See A32. |
| A34 | medium | Stats 'All' range silently truncates at the 1,000 most recent entries and disagrees with Reports | Fixed: See A32. |
| A35 | medium | Stats windows go stale across midnight: the fingerprint only tracks diary content, so returning to the tab on a new day shows yesterday's 7D/30D/90D window | Fixed: The focus fingerprint includes today's local day key (trends.tsx:167), so a new day recomputes every window. |
| A36 | medium | Startup DB init/reminders load has no catch: a migration failure crash-loops with no breadcrumb, no fallback and the splash never hides | Fixed: runStartup() wraps initDatabase()/applyUsageConsent() in try/catch → recordError + <ErrorBoundary error retry> (app/_layout.tsx:168-210, app/components/ErrorBoundary.tsx); ErrorBoundary is also exported for expo-router. |
| A37 | medium | Reminder notifications are rescheduled at launch with i18n still on 'en', and never re-synced after a language change | Fixed: Language is applied synchronously in LanguageProvider's initializer and _layout.tsx re-syncs reminders on i18n languageChanged (resyncReminderNotificationsIfPermitted). |
| A38 | medium | LockScreen re-prompts on every 'active' transition, so a cancelled biometric prompt immediately reopens | Fixed: LockScreen keeps a cancelledRef: after a cancelled prompt no auto-prompt until a real background→active transition or the Unlock button (LockScreen.tsx:39-78). |
| A39 | medium | Automatic language never matches Indonesian on Android (device reports legacy code 'in') | Fixed: normalizeLanguageCode maps in→id, iw→he, ji→yi before matching (app/utils/languageCodes.ts, LanguageContext.tsx). |
| A41 | medium | Deleting an entry orphans its join rows, so a custom trigger/sound type used only on deleted entries can never be deleted | Fixed: PRAGMA foreign_keys = ON after open (database.ts:9); deleteEntry deletes both join tables + the entry in one transaction (queries.ts:250-258); usage counts and delete guards join entries; one-time cleanOrphanedLinks() migration. |
| A42 | medium | deleteEntry leaves orphan join rows; FK cascade is inert | Fixed: See A41; deleteAllEntries is one transaction. |
| A43 | medium | Deleting an entry leaves orphaned join rows, inflating usage counts so custom triggers/sound types become undeletable | Fixed: See A41. |
| A51 | medium | On iOS the date/time pickers are never dismissed and stay inlined in the layout | Fixed: iOS pickers are display="compact" inline in the header (EntryForm.tsx:461-485); Android dialogs close on every result. |
| A53 | medium | Linking.openURL calls are unhandled, so "Email Support" and the legal/website links silently do nothing when no handler app exists | Fixed: Every external link goes through openExternalUrl() (app/utils/links.ts) with recordError + StatusDialog on failure; no bare Linking.openURL left in app/ or src/. |
| A58 | medium | Anchor check-in subsystem (prompts table, source column, 9 queries, 90 lines of scheduling) is dead code shipped with a migration that runs every launch | Fixed: See A25. |
| A59 | medium | `userInterfaceStyle: "light"` is dead config on Android and breaks the Automatic theme on iOS | Fixed: See A28. |
| A60 | medium | Guide says no direction is named when the 95% range crosses zero; the Trigger Impact panel names one at 60% probability regardless | Fixed: statesDirection() (triggerModel.ts:108) requires the 95% interval to exclude zero; the panel, the PDF and the pattern_found milestone use it; the guide text now matches. |
| A61 | medium | The 'legacy'/'scheduled'/'self_initiated' entry source is documented as excluding pre-anchor entries from the inferential model, but no model consumer reads it | Fixed: See A25 — the column is kept only for backup compatibility and documented as such (database.ts). |
| A62 | medium | Re-importing a backup duplicates every entry — no identity or dedup on import | Fixed: importEntries dedupes on (created_at, intensity, note) against existing rows and within the file, reporting skippedDuplicates (queries.ts:365-385, importValidation.ts entryKey). |
| A63 | medium | Import always appends; restoring your own backup duplicates every entry | Fixed: See A62. |
| A64 | medium | 'Restore from backup' appends with no duplicate detection, so a second import doubles every entry | Fixed: See A62 — the import dialog reports the skipped duplicates (myData.importSkippedDuplicates). |
| A67 | medium | The same Switch control means "applied" on Reminders/Reports but "pending until Save" on Triggers/Sound Types; Cancel and hardware back discard silently | Fixed: ManageItemsScreen and SingleChoiceScreen use useDiscardGuard (beforeRemove) with a Discard ConfirmDialog; Cancel/back/hardware back all prompt while dirty; iOS swipe disabled while dirty. |
| A71 | medium | Delete-entry confirmation dialog has a hardcoded English "Cancel" button | Fixed: ConfirmDialog uses t('common.cancel') and defaults confirmLabel to t('common.delete'); StatusDialog defaults to t('common.ok'). |
| A74 | medium | Hard-coded "Cancel" (and default "OK") in shared dialogs used by every destructive action | Fixed: See A71. |
| A76 | medium | Plural forms stop at _one/_other and the runtime has no Intl.PluralRules, so every language gets English plural rules | Fixed: intl-pluralrules is imported before i18n.init (app/i18n/index.ts:3); every plural base has every CLDR category in all 28 locales, asserted by tests/i18n/plurals.validation.ts (13 pluralised keys). |
| A79 | medium | German copy calls Trigger Impact three different names: 'Auslöserwirkung' (Learn), 'Trigger-Einfluss' (guide) and 'Auslöser-Einfluss' (Stats card, Milestones) | Fixed: The German guide uses Auslöser-Einfluss throughout (0 × Trigger-Einfluss in guides/de.ts). |
| A80 | medium | PDF prints built-in trigger names in English and numbers with a '.' decimal regardless of report language | Fixed: reportHtml.ts prints triggerLabel(t, name) and formats numbers with a locale Intl.NumberFormat (reportHtml.ts:3, 24-30, 107). |
| A81 | medium | PDF report prints built-in trigger names in English regardless of app language | Fixed: See A80. |
| A82 | medium | The methodology guide describes features the shipped model no longer has: a collinearity flag and a 90% display threshold | Fixed: The SORTING paragraph now describes the signed Effect order ("from most worsening to most improving"), matching TriggerImpactCard.tsx:284-289. |
| A83 | medium | Thirteen useMemos depend on i18n label arrays that are new objects on every render, so they recompute on every tap/toggle regardless of the fingerprint optimisation | Fixed: Same as A23 (trends.tsx:204-216). |
| A84 | medium | DB-pull helper drops a personal health database into the repo root with no .gitignore rule | Fixed: pulldb.sh deleted; .gitignore has *.db/*.db-journal/*.db-wal/*.db-shm/*.sqlite/*.sqlite3. |
| A88 | medium | Tests exist but cannot be run from the repo: no test/lint/typecheck scripts, tsx not installed, no ESLint config, minimal tsconfig | Fixed: package.json has typecheck, test and test:calibration scripts; tsx is a devDependency; tests/setup.ts defines __DEV__. |
| A90 | medium | Test suite has no runner, is never executed, and is already failing | Fixed: See A88 — npm test runs 5 suites, all PASS at ab20712. |
| A91 | medium | Custom tab bar buttons discard the accessibility props react-navigation supplies; the Add FAB is an unlabeled icon-only control | Fixed: TabBarButton forwards the navigator's accessibility props ({...rest}) to the Pressable (app/(tabs)/_layout.tsx:21-33). |
| A93 | medium | Three dead-end "Coming soon" rows (Pitch Test, Rate app, Widgets) ship in the production More tab | Fixed: Rate app opens the Play listing (market:// then https) via openExternalUrl; app/coming-soon.tsx and the cs() helper are gone. |
| A96 | low | Home computes its 7-day stats from a 200-row cap while Stats uses 1000, so the two can disagree despite the comment promising they cannot | Fixed: Home loads its stats input by local day (today-13 onward) with getEntriesSince (index.tsx:76-84), the recent list separately with getRecentEntries(20). |
| A98 | low | "Today" is captured at render time on both tab screens, so neither notices a date rollover while it is on screen | Fixed: Home and Calendar keep todayKey/todayStr in state refreshed on focus and on AppState active (index.tsx:139-165, calendar.tsx:76-82). |
| A99 | low | Pending-date focus branch leaves `skipFocusResetRef` armed, so the next ordinary tab return skips the snap-to-today once | Fixed: The pending-date focus branch clears skipFocusResetRef (calendar.tsx:137). |
| A100 | low | "Yesterday" is derived by subtracting 24 h, which is not one calendar day across a DST change | Fixed: Yesterday is computed by calendar-day arithmetic from todayKey (index.tsx:63-68). |
| A101 | low | Greeting is computed once per mount and never refreshes with the time of day | Fixed: Greeting is state refreshed on focus and on AppState active (index.tsx:140-165). |
| A102 | low | Change caption can print "-0%" / "+0%" because the sign is taken from the unrounded value | Fixed: Change captions use formatSigned() with signed levels; the percent variant is no longer shown. |
| A103 | low | Startup DB initialisation has no error path: a failing migration crashes the app without being reported | Fixed: See A36. |
| A104 | low | Name uniqueness is case-sensitive in the schema but case-insensitive in the add path | Fixed: seedLookupRow() inserts a built-in only when no row matches COLLATE NOCASE (database.ts:206-216). |
| A105 | low | Pulsatile/Thrumming split migration no-ops if the user already created a custom 'Pulsatile', leaving the combined built-in row forever | Fixed: splitPulsatileThrummingType() merges the combined row's links into an existing custom Pulsatile (case-insensitive) and drops the combined row (database.ts:159-190). |
| A106 | low | Entry save has no error path: a failed SQLite write throws inside the press handler and crashes the app with no message | Fixed: EntryForm.handleSave wraps onSave in try/catch → recordError + saveFailed StatusDialog, form kept (EntryForm.tsx:413-434). |
| A107 | low | Keyboard overlap subtracts the bottom safe-area inset on iOS too, over-lifting the footer | Fixed: useKeyboardOverlap subtracts insets.bottom on Android only (useKeyboardOverlap.ts:21-23). |
| A108 | low | Source links call `Linking.openURL` without handling rejection, unlike the support directory | Fixed: See A53. |
| A109 | low | Import does not re-evaluate milestones, so the More-tab 'new' badge never fires for restored data | Fixed: handleImport calls syncAchievements() after a successful import (my-data.tsx:351). |
| A110 | low | rangeDayCount('All') counts days from a UTC instant while every other Stats figure uses local day keys, so the Entries tile can read '2 of 1 days' | Fixed: rangeDayCount('All') counts local day keys from oldestDay to today (sevenDayTrend.ts:344-353). |
| A111 | low | Overlapping syncReminderNotifications calls interleave cancel-all/schedule and produce duplicate notifications | Fixed: syncReminderNotifications is serialised on a module promise chain, reads the DB inside the task and never rejects (notifications.ts:66-80). |
| A112 | low | Reminder sync is cancel-all-then-reschedule with no serialisation; overlapping toggles can leave a disabled reminder scheduled | Fixed: See A111. |
| A113 | low | 'First pattern' milestone requires 90% probability while Trigger Impact states a direction at 60% | Fixed: PATTERN_PROBABILITY = MEANINGFUL_PROBABILITY and the milestone also requires statesDirection (evaluate.ts:86-121). |
| A115 | low | 'Generated' date in the PDF is the UTC date, not the user's local date | Fixed: generatedAt is a local date key (reportData.ts:128). |
| A118 | low | Dead template entry (App.tsx/index.ts) and stale README/prompt.txt describe an app that does not exist | Fixed: App.tsx, index.ts and prompt.txt deleted; README rewritten. |
| A119 | low | Dead code and duplicate route files: unused PlaceholderScreen, SCALE_LABELS, settings `cs`, several unused styles, and two empty `/add` route files | Fixed: app/add.tsx, PlaceholderScreen and SCALE_LABELS are gone. |
| A121 | low | Dead sort option, unused styles, and a ghost render that runs the temporal fit and mounts an InfoModal twice per open panel | Fixed: longestWith/longestWithout are computed by fitTemporalProfile (triggerModel.ts:359+); CollapsiblePanel renders its children once; the dead styles are gone. |
| A123 | low | Dead component with hard-coded English and ten unreferenced translation keys | Fixed: PlaceholderScreen deleted; the unreferenced keys were removed from all 28 locales (parity test). |
| A124 | low | Intensity is 0–5 in code but documented as 1–5, with no DB constraint | Fixed: CHECK (intensity BETWEEN 0 AND 5) for new installs + assertIntensity() in saveEntry/updateEntry (database.ts:38, queries.ts:194-211, 487). |
| A125 | low | Dead state, unused imports and unused styles in both entry forms | Fixed: intensityError state and the UIManager.setLayoutAnimationEnabledExperimental call are gone. |
| A126 | low | Automatic first-day-of-week resolution is duplicated in the settings screen | Fixed: first-day-of-week.tsx reuses the exported resolveAutomaticFirstDay() from the context. |
| A127 | low | `Animated.event` and the interpolation nodes are rebuilt on every render of the host screen | Fixed: useHeaderScrollAnim memoises the Animated.event and interpolations (useRef/useMemo). |
| A129 | low | Deprecated `expo-router/babel` plugin still configured; warns on every bundle | Fixed: babel.config.js has no plugins entry. |
| A130 | low | metro.config.js carries a no-op condition override with a false comment plus a stub for an unused dependency | Fixed: metro.config.js is the default config. |
| A131 | low | Unused dependencies, dead template files, empty routes and a deprecated Babel plugin | Fixed: @expo/vector-icons removed, App.tsx/index.ts/app/add.tsx/PlaceholderScreen deleted, expo-router/babel removed. |
| A132 | low | Dependency hygiene: floating `latest` CLI tag, two unused packages, and a broken `web` script | Fixed: @react-native-community/cli pinned ^20 as a devDependency, @expo/vector-icons and the web script removed (react-dom kept — expo-router needs it). |
| A133 | low | Stale committed artefacts: pulldb.sh targets Expo Go's data dir, prompt.txt is an unrelated scaffold prompt, App.tsx/index.ts are the unused template entry | Fixed: pulldb.sh, prompt.txt, App.tsx, index.ts deleted. |
| A134 | low | withEnglishMetadata throws at module-evaluation time and only guards one direction of drift | Fixed: withEnglishMetadata warns in __DEV__ instead of throwing and drops unknown slugs (content.ts:44-60). |
| A136 | low | iPad support is declared (including landscape) while every layout is phone-width with no maximum content width | Fixed: ios.supportsTablet is false. |
| A137 | low | Calendar cells encode a day's maximum intensity while every chart encodes the day's mean | Fixed: Calendar's detail panel says the grid shows the day's highest level (calendar.detailHint). |
| A139 | low | 'Delete All Data' also erases event-based milestones that the diary cannot reconstruct | Fixed: deleteAllEntries keeps first_report and first_guide (EVENT_ONLY_ACHIEVEMENTS, queries.ts:448-460). |
| A142 | low | 'Coverage %' means two different things depending on the range toggle | Fixed: coverage = logged days / days since the first entry in the period (coverageDays), with a note in the PDF (reportData.ts:117-131). |
| A143 | low | No native per-app language declaration (locales_config.xml / CFBundleLocalizations) | Fixed: expo-localization plugin lists supportedLocales for the 28 languages on both platforms (app.json). |
| A144 | low | Averages always use '.' as decimal separator | Fixed: formatNumber/formatSigned/formatPercent (app/utils/format.ts) use a locale Intl.NumberFormat; Home, Stats and the PDF use them. |
| A146 | low | Reminder notifications can be (re)scheduled in English at cold start and are never re-synced after a language change | Fixed: See A37. |
| A149 | low | Recent-entries list constructs a new Intl.DateTimeFormat for every row older than yesterday, on every focus | Fixed: Home caches one Intl.DateTimeFormat per locale|timezone (index.tsx:51-61). |
| A150 | low | Screen-view analytics logs raw pathnames including entry ids, fragmenting screen names | Fixed: Screen views log the route pattern from useSegments() (app/_layout.tsx:126-129). |
| A151 | low | getAllEntriesWithRelations is O(entries x joinRows) and runs on every Save via syncAchievements | Fixed: getAllEntriesWithRelations groups join rows once by entry id (queries.ts:288-310). |
| A152 | low | Every save re-evaluates achievements over the whole diary with an O(entries × join rows) scan on the JS thread | Fixed: See A151. |
| A153 | low | Per-save achievement sync and per-row date formatting scale badly with diary size | Fixed: See A151 and A149. |
| A156 | low | SYSTEM_ALERT_WINDOW and legacy external-storage permissions ship because app.json never blocks Expo's optional defaults | Fixed: blockedPermissions also lists SYSTEM_ALERT_WINDOW and READ/WRITE_EXTERNAL_STORAGE (app.json). |
| A159 | low | Import reads and parses the whole picked file synchronously with no size cap | Fixed: Import rejects files over 20 MB or 100 000 entries before parsing/inserting (my-data.tsx:49-50, 312-338). |
| A160 | low | Calibration study reports FAIL but always exits 0 | Fixed: calibration.test.ts exits 1 on FAIL and has its own test:calibration script. |
| A161 | low | Hard-coded light-mode colours leak into dark mode on the Calendar count badge and Learn list | Fixed: The Calendar count badge and Learn's amber accent are theme-aware (calendar.tsx:569, theme.ts learnAccent). |
| A162 | low | Home greeting is computed once per language and never refreshed, so it goes stale while the app stays open | Fixed: See A101. |
| A163 | low | 'Not enough data for this period yet' is shown for two cases where it is false: the 7D range (model can never run) and a trigger present on every logged day | Fixed: The card shows one "needs {{count}} logged days" notice for 7D, hides per-row dashes and the Effect sort, and an always-present trigger gets stats.trigger.alwaysPresent (TriggerImpactCard.tsx:226-232, 335-338, 403-406). |
| A164 | low | Day-of-week card and 90D weekly buckets hard-code Monday-first, ignoring the First Day of Week setting the Calendar honours | Fixed: Day-of-week and 90D weekly buckets follow useFirstDayOfWeek().resolvedFirstDay (dayOfWeek.ts, sevenDayTrend.ts weeklyItemBuckets, trends.tsx:208-235). |
| A165 | low | Range change closes list panels but not the chip-view panel, and the day-before/day-after tiles show point estimates with no uncertainty | Fixed: The chip panel closes on range change (TriggerImpactCard.tsx:234-239); the day-before/after tiles show their 95% ranges (dayAfterRange/dayBeforeRange). |
| A166 | low | Saved language is applied in a passive effect after the first commit, so the first painted frame is English | Fixed: LanguageProvider applies the saved language inside its useState initializer, before the first commit (LanguageContext.tsx:83-100). |
| A168 | low | Back navigation discards a partially filled form with no confirmation | Fixed: EntryForm uses useDiscardGuard with a Discard ConfirmDialog on header/hardware/swipe back; swipe disabled while dirty (EntryForm.tsx:345, 443, 680+). |
| A169 | low | Notes field has no length limit, unlike every other text input in the app | Fixed: Notes are capped at NOTES_MAX_LENGTH = 2000 with a counter (EntryForm.tsx:41, 643). |
| A171 | low | Unknown-slug fallback renders a bare text with no header or back button | Fixed: The not-found branch renders the shared header with the back button (learn/[slug].tsx:32-45). |
| A172 | low | "Skip" on the onboarding slides does the same thing as "Continue" on the last slide and does not skip the rest of onboarding | Fixed: The last slide has showSkip: false; Skip is documented as skipping the intro slides only (onboarding/index.tsx:36-37, 93). |
| A174 | low | Delete icons are 24×24pt and several icon buttons are under the 44pt/48dp minimum tap target | Fixed: Delete/back/info buttons carry hitSlop to reach 44pt and the trash button is a 36pt box (reminders.tsx:132, 190, 405; ManageItemsScreen.tsx:170, 343). |
| A177 | low | Linking.openURL rejections are unhandled on five screens, so buttons silently do nothing without a mail/browser app | Fixed: See A53. |
| A178 | low | Note line breaks are collapsed in the PDF report | Fixed: Note line breaks become <br/> in the PDF (reportHtml.ts:182). |
| L2 | critical | Analytics, crash and performance telemetry start on launch with no consent and no opt-out | Fixed: firebase.json sets perf_auto_collection_enabled and google_analytics_adid_collection_enabled to false; setPerformanceEnabled() follows consent and trace() runs untraced without it (performance.ts, consent.ts). |
| L12 | low | Lock-screen notifications name the condition | Fixed: The default reminder body is "Time for your daily check-in." (no condition named). |
| L13 | low | Tests never run | Fixed: See A88. |
| L14 | low | Startup crash path | Fixed: See A36. |
| L15 | low | Native UI theme | Fixed: See A28. |
| L16 | low | Repo hygiene that can leak into store copy | Fixed: README rewritten; pulldb.sh, prompt.txt, App.tsx, index.ts deleted. |
| L17 | low | Disclaimer acknowledgement is not recorded | Fixed: Disclaimer acceptance stores disclaimer_accepted_at and disclaimer_version (onboarding/disclaimer.tsx:15, 34-35). |
| S3 | low | Stats keeps old-language axis labels and date range after a language switch | Fixed: itemBuckets and rangeDates depend on i18n.language (trends.tsx:226, 262). |
| S4 | low | Locked Pro cards and badged controls in Stats have no screen-reader role or label | Fixed: LockedStatsCard and every locked control carry role/label/selected state and an "opens upgrade" hint. |
| S5 | low | report_created is logged even when the share or save is cancelled | Fixed: report_created logs only on a confirmed save; a share logs action: share_opened (reports.tsx:84-94). |
| S6 | low | LanguageContext mutates module state inside useMemo | Fixed: The language is applied in the useState initializer (applyLanguage), not inside useMemo. |
| S10 | high | RevenueCat receives the Firebase app instance id at startup, before usage-data consent | Fixed: linkFirebase() runs only from applyChoice(true) in consent.ts, never at startup (purchases.ts:29-39). |
| S11 | high | Firebase Performance uploads traces without consent: perf_auto_collection_enabled is not set | Fixed: perf_auto_collection_enabled: false in firebase.json; setPerformanceEnabled() bound to consent. |
| S12 | medium | Lock screen has no BackHandler: Android Back reaches the navigator underneath while locked | Fixed: LockScreen registers a BackHandler that swallows Back while locked (LockScreen.tsx:3, 80-84). |
| S13 | medium | Delete All Data does not reset the Firebase analytics instance id | Fixed: Delete All Data calls resetAnalyticsData() and re-links RevenueCat only with consent (my-data.tsx:399-403). |
| S15 | low | No red-flag guidance when logging sudden hearing loss or pulsatile tinnitus | Fixed: A red-flag paragraph (medicalDisclaimer.redFlags, onboardingDisclaimer.redFlags, localSupport.redFlags) is shown to every user; the Sound Type tooltip and a note under a selected Pulsatile type say to mention a pulsing sound to a doctor. |
| S16 | high | Stats locked card and onboarding copy claim triggers *make* tinnitus louder and promise relief, contradicting the app's association-only framing | Fixed: stats.trigger.lockedBody, the empty states and the onboarding slides use association-only wording in all 28 locales. |
| S17 | high | Sound Type tooltip gives a diagnostic explanation and a 'sound therapy matching' purpose | Fixed: entryForm.tooltips.soundType no longer explains causes or mentions sound therapy; it tells the user to mention a pulsing sound to a professional. |
| S18 | high | Every red-flag and crisis sentence is behind the Learn paywall; free users never see urgent-care guidance | Fixed: See S15. |
| S19 | high | iOS widgets never decode the snapshot: WidgetLevel.textColor is non-optional but the app never writes it | Fixed: WidgetLevel.textColor is optional (Snapshot.swift:13). |
| S20 | medium | iOS edit deep link has a literal '(id)' instead of the interpolated entry id | Fixed: The edit URL interpolates \(id) (Snapshot.swift:101). |
| S21 | medium | Import can disable a built-in trigger or sound type through a case-insensitive name collision | Fixed: Import maps are lower-cased and is_active:false only applies to rows the import created (upsertCustom*, queries.ts:344-363). |
| S22 | medium | Reminder toggle schedules the notification before the permission request and never re-syncs after permission is granted | Fixed: requestPermissionForReminder re-syncs after a grant (reminders.tsx:72-79). |
| S23 | low | Reminder soft-ask consumes one of its two lifetime asks while the dialog is suppressed by App Lock | Fixed: markReminderPromptShown() runs in an effect gated on visible && !suppressed (ReminderPromptHost.tsx:53-58). |
| S24 | low | 90D chart buckets cover up to 91 days while the tiles filter 90 | Fixed: weeklyItemBuckets clips at rangeStartKey('90D') (sevenDayTrend.ts:185-200, getItemBuckets). |
| S25 | medium | Imported backup JSON (health data) stays in the app cache forever | Fixed: The picked cache copy is deleted in finally (my-data.tsx:313-322). |
| S26 | low | Malformed widget deep link throws URIError inside redirectSystemPath | Fixed: decodeURIComponent is wrapped in try/catch and a malformed link opens the app (widgetLinks.ts:33-39). |
| S27 | high | Intensity colours used as text fail WCAG contrast (yellow 1.5:1, green 2.0:1, red 3.5:1) | Fixed: Intensity-coloured text uses intensityTextColor/levelTextColor (SCALE_TEXT_COLORS, ≥ 4.5:1 in light mode); fills and icons keep SCALE_COLORS. |
| S29 | medium | Stats range, view, sort and day-of-week controls lack accessibility role, label and selected state | Fixed: Range segments, view toggles, sort chips, day-of-week chips, trigger rows and chart touch targets carry roles, labels and selected/expanded state. |
| S30 | low | 'Verified tinnitus organizations' undercuts the directory's own non-endorsement notice | Fixed: more.findLocalSupportSubtitle is "Independent tinnitus organizations by country". |
| S32 | low | openNotificationSettings opens Android App Info rather than the notification page, and suppresses App Lock for a genuinely external screen | Fixed: openNotificationSettings uses Linking.sendIntent(APP_NOTIFICATION_SETTINGS) on Android and no longer suppresses App Lock (notifications.ts:45-53). |
| S33 | low | Change tile shows 20 × levels as a percentage while the trigger panel uses levels | Fixed: Change tiles show signed levels on Home and Stats (formatSigned + stats.trigger.levels). |
| S34 | low | PDF trend line spaces logged days evenly by index, hiding gaps | Fixed: Trend points are placed by date with month ticks (reportHtml.ts:35-77). |
| S35 | low | French formal leftover: achievements.yourMilestones is 'VOS ÉTAPES' | Fixed: fr.json achievements.yourMilestones is "TES ÉTAPES". |
| S37 | low | Release-checklist docs reference an in-app 'clinical review required' marker that no longer exists, and the 2026-11-10 Learn expansion has no review entry | Fixed: learn-clinical-review-package.md replaces the in-app marker with a sign-off table and records the 2026-11-10 expansion. |
| S38 | low | 'Average pitch / location / distress broken down by day of the week' describes a composition chart as an average | Fixed: stats.byDayOfWeek*Desc describe shares ("How the pitch you logged is spread across…"). |
