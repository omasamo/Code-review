# Main re-check — 27 October 2026

Checked: `kamil12345/tinnitus-app` `main` @ `6be7c70` (26 Oct 2026, "Merge pull request #10 from kamil12345/kamil"). Compared with the previous re-check (`26dedb1`, 10 Oct) and the PR #8 fix round (merged 14 Oct). 39 commits and 436 files (+15,342 / −5,846) since 26dedb1: PR #8 (review fixes), PR #9 and #10 (home-screen widgets, usage-data consent, More sub-screen design, Downloads export, Remote Config removed). Read-only review; nothing changed in the app.

The dashboard data (`docs/data/findings.json`) carries the per-finding verdicts; this file is the narrative.

## Automated checks

| Command | Result |
|---|---|
| `npm install` | OK |
| `npx tsc --noEmit` | 0 errors |
| `npx tsx tests/features.validation.ts` | PASS |
| `npx tsx tests/stats/triggerModel.validation.ts` | PASS |
| `npx tsx tests/stats/calibration.test.ts` | PASS |

Still no `test`/`typecheck`/`lint` scripts in package.json, `tsx` is not a devDependency and there is no CI (`.github/workflows` absent) — A88–90, A160 open.

## Summary

| Status | Findings |
|---|---|
| **Fixed in this range** | A38 biometric re-prompt loop (LockScreen.tsx:27-36, appLock.ts:58), A68 dates follow the app language, A72/A77 translations complete (0 missing keys in all 27 locales vs 662 en keys), A104 case-insensitive trigger duplicates (queries.ts:124,162), A130 Metro workaround removed (c584d9e), S3 axis labels after a language switch, S8 dark-mode textMuted #838E9F (theme.ts:129), S9 App Lock grace for system dialogs (AppLockContext.tsx:47-66, appLock.ts:22-44). Confirmed still fixed from PR #8: seed data, dev menu and tier override, runtimeVersion fingerprint, allowBackup, AD_ID + ad-services blocked, edit keeps date/timezone, App Lock overlay, double-tap Save, delete navigation, day counts, change tile, contrast, backup import validation/transaction/custom items/schema v3. |
| **Partly** | A93/A175 (Pitch Test removed, Widgets real; "Rate app" still → /coming-soon, more.tsx:264-266), L2 (Analytics and Crashlytics opt-in; Performance and the RevenueCat link are not), A54/A55 (PDF deleted after shareAsync resolves; Android still depends on the chooser), A52/A158 (Android staging file deleted; iOS backup JSON stays in Paths.cache, my-data.tsx:257-263), A56 (`hexToRgba` still local in 21 files), A116–118/A124 (CLAUDE.md correct; AGENTS.md:30 and README.md:35,60,63 still wrong), A131 (gifted-charts removed; `@expo/vector-icons` and `@react-native-firebase/remote-config` unused), A76 (ru/uk 4 of 11 plural keys, lv no `_zero`, no `Intl.PluralRules` polyfill), A80/A81 (sound types translated in the PDF, trigger names raw), A78 (Intl.DisplayNames now used, Hermes support unverified), L9 (Pitch Test gone, memo still to write). |
| **Still open** | L1 privacy policy, A41–43 foreign keys / orphans, A28–30/A59 iOS forced light, A36/A103 no catch or ErrorBoundary, A51 iOS picker, A173 reminder switch after denial, A168 no discard prompt, A23/A24/A83, A27 (8 src→app imports), A25/A26/A58 dead anchor code, A71/A73/A74 ConfirmDialog buttons, A60/A82 guide vs 60 % direction, A88–90/A160, A129, A84, A155 (7 MB images), A136, A32–35/A96/A98 caps and midnight, A62–64 duplicate import, S4, S5, S7, Council #10. |
| **Worse** | A24: trends.tsx now 2,456 lines. |

## New findings (S10–S15)

1. **S10 — RevenueCat receives the Firebase app instance id before consent.** `app/utils/purchases.ts:29,35-39` calls `getAppInstanceId()` and `Purchases.setFirebaseAppInstanceID()` at startup regardless of `usage_data_consent`. Gate on `hasUsageConsent()` and re-run when consent is granted.
2. **S11 — Firebase Performance is not consent-gated.** `firebase.json` lacks `perf_auto_collection_enabled: false` and nothing calls `setPerformanceCollectionEnabled`; traces from `app/my-data.tsx:28` are uploaded for users who declined. `google_analytics_adid_collection_enabled` is also unset (low impact, AD_ID blocked).
3. **S12 — Lock screen has no BackHandler.** `LockScreen.tsx` is an overlay (`_layout.tsx:137-138`); Android Back while locked reaches the navigator underneath.
4. **S13 — Delete All Data does not reset the analytics instance id.** No `resetAnalyticsData` anywhere (`my-data.tsx:351-360`).
5. **S14 — `@react-native-firebase/remote-config` still in package.json:19** after 414c920 removed its use. Removing it changes the fingerprint, so do it before the next store binary.
6. **S15 — No red-flag guidance at logging time** (council item #10): sudden hearing loss / pulsatile tinnitus advice exists only in one Learn guide.

## Priorities carried over

- **L1:** the live policy (kappsa.tech/Privacy-Policy, updated 2026-06-16) still claims AdMob ads, email accounts, cross-device sync and age collection, and omits EAS Updates and the in-app opt-in. Firebase, Analytics, RevenueCat and "health data stays on the device" are stated correctly.
- **A36/A103:** `app/_layout.tsx:160-174` is `try { initDatabase() } finally {…}` with no catch; no ErrorBoundary.
- **A62–64:** importing the same backup twice inserts every entry again (`queries.ts:496-523`).
- **A41–43:** no `PRAGMA foreign_keys`; `deleteEntry` (`queries.ts:296-298`) orphans join rows; `deleteAllEntries` (`:560-565`) is not transactional.
- **A150:** screen views logged with the raw pathname including entry ids (`_layout.tsx:112-116`).
- **A65 / S7:** with Remote Config gone, the paywall (after the new privacy step, `onboarding/privacy.tsx:6`) and Learn (`more.tsx:233-240`) are shown unconditionally; clinician and native-speaker sign-off for Learn still pending (`learn-clinical-review-package.md:3`).

## Smaller open items

- `ConfirmDialog.tsx:23,59` hard-codes English "Delete"/"Cancel" in all 28 languages (A71).
- Plurals: ru/uk lack `_few/_many` for `personalization.activeCount`, `myData.entriesLogged`, `myData.daysAgo`, `myData.importCompleteMessage`, `myData.dataDeletedMessage`, `myData.importSkippedEntries`, `myData.importSkippedLinks`; lv has no `_zero` (A76).
- PDF trigger table prints raw `item.name` (`reportHtml.ts:116-118`); `triggerLabel` in `builtInNames.ts:51` is unused (A80/A81).
- Stats guide says no direction when the 95 % range crosses zero; the app prints "{percent}% likely" at ≥ 0.6 (`trends.tsx:325-337`, `guides/en.ts:34`) (A60/A82).
- Reminder is persisted as enabled before `ensureNotificationPermission()` (`reminders.tsx:57-66`) (A173).
- iOS date/time picker never closes (`EntryForm.tsx:460-484`) (A51); no dirty check on leave (A168).
- `LockedStatsCard` (`trends.tsx:429-460`) and `ProBadge` have no accessibility role or label (S4).
- `README.md:35,60,63` describe accounts, an Express backend and FCM push; `AGENTS.md:30` says intensity 1–5; `CLAUDE.md:75` keeps a stale note.
- `babel.config.js:5` deprecated `expo-router/babel`; `pulldb.sh` still tracked; `assets/onboarding/slide*.png` 0.96–1.4 MB each (A129, A84, A155).
- `ios.supportsTablet` true with phone-only layouts (`app.json:11`) (A136).
- Strings identical to English (length > 3): da 16, fr 20, nl 20, ro 18, de 15, sv 13, es 12, id 10 — mostly proper nouns, worth a native skim. Extra `stats.trigger.dayCount_other` in cs/hu/it/pt-BR/pt-PT/ru/sk/sl/uk is harmless.

## Verified, no issue (new code)

- Widgets: deep links validated (`widgetLinks.ts:26-36`, intensity `/^[0-5]$/`), Pro actions re-check the tier (`useWidgetActions.ts:21-24`), App Lock publishes a "private" snapshot without data (`widgets.ts:77`), snapshot prefs `MODE_PRIVATE` (`WidgetSnapshot.kt:70,76`), the exported `TIME_SET`/`TIMEZONE_CHANGED` receiver is required (`home-widgets AndroidManifest.xml:66-73`).
- Consent flow: `firebase.json` disables auto-collection for Analytics and Crashlytics; `consent.ts` toggles collection and calls `deleteUnsentReports` on decline; existing installs get a one-time ask (`app/index.tsx:9` → `/consent`); changeable in Settings › Privacy.
- No TODO/FIXME/console.log or release-reachable dev-only code added in the diff.
