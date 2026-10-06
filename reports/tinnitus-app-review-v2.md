# Tinnitus Tracker: full app review, v2

Covers `main` at commit 5513c30 (2026-10-05). Nothing in the repo was changed.

**How this was checked.** Eleven reviewers each read one area of the app line by line: data, entry forms, home and calendar, stats, app lifecycle, features, architecture, design, security, translations, and tooling. Every issue they raised then went to three separate checkers. One traced the code path, one judged the real user impact, and one tried to prove the issue wrong. An issue stays only if at least two of the three agreed. A further round looked for gaps. That process left **178 confirmed issues**. Several were found by more than one reviewer, so they collapse to about 110 distinct problems. I also re-read the most serious ones in the code myself. Every item below gives its file and line, plus an `A#` number that points to the full evidence in the **appendix** (`tinnitus-app-review-v2-evidence.md`). The legal and privacy findings from v1 are folded in and marked **L#**.

**In one paragraph:** the product thinking is strong. The statistics are careful, the language is honest about association versus cause, the diary is local-first, and the PDF is privacy-aware. The problems come from fast growth. Release-only safeguards were left switched off, data moves in and out without validation, a few date and timezone paths contradict their own comments, the same code has been copy-pasted until the copies drift apart, translations are far from finished, and nothing runs the tests. None of it is hard to fix, but the first block has to be fixed before any public release.

---

## 1. Must fix before release

| # | Problem | Why it matters | Where |
|---|---|---|---|
| 1 | **Fake data and a fake user on every new install.** `seedDevData()` runs unguarded: it adds 15 invented symptom entries, sets the name to "Alex" **and marks onboarding as complete**. | A real user never sees the onboarding, the name step or the **medical disclaimer**, and the made-up history feeds the charts, the PDF for their doctor, and their backups. | `app/db/database.ts:104`, `:290-292` (A1, A8) |
| 2 | **The privacy policy describes a different app.** It names "TinnitusTrack", claims the app collects age, lists AdMob, and leaves out Crashlytics, Performance, Remote Config and EAS Updates. | Both stores reject apps whose policy doesn't match the binary (Apple 5.1.1, Play Data safety). | `app/about.tsx:95`, live page (L1) |
| 3 | **Analytics and crash reporting start without consent and can't be switched off.** | Apple 5.1.1(ii) requires consent and a way to withdraw it, and so does GDPR for EU users. Screen names also reveal which health guides someone reads. | `app/_layout.tsx:57-59`, `:87`; `app/utils/crashlytics.ts:16` (L2, A150) |
| 4 | **The subscription sells nothing.** The paywall and banner promise "Unlimited entries, full reports & more", but `isSubscribed` only changes labels in the More tab. | Apple 3.1.2(a) requires ongoing value, and paying for nothing is a refund and consumer-law risk. | `app/(tabs)/more.tsx:102-103`, `:122-264`; `app/onboarding/disclaimer.tsx:25` (L3, A65) |
| 5 | **Over-the-air updates can crash existing installs.** The runtime version is tied to the app version (1.1.0, set on 14 Sept), but RevenueCat and other native modules were added after that. | An `eas update` from today's code would reach 1.1.0 builds that don't contain those native modules, and the app would crash on launch. | `app.json:76-87`; git: bump `c183571` 09-14, RevenueCat `5e73be9` 09-26 (A5) |
| 6 | **Restoring a backup can break the app or corrupt the diary.** Import only checks that `intensity` is a number and `created_at` isn't empty. It runs without a transaction and always appends. | An intensity of 8, or a date that can't be parsed, can crash Stats or Home. A bad row halfway through leaves half an import behind an "Import failed" message. Restoring twice doubles every entry. Custom triggers are silently dropped on a new phone. | `app/db/queries.ts:334-360`; `app/my-data.tsx:141-151`, `:200` (A10, A11, A17, A44-49, A62-64) |
| 7 | **Learn shows "Clinical review required before release" to users**, and the new Medicines guide isn't in the clinical review pack at all. | This is an internal note on screen, and the drug-related content is unreviewed. | `app/learn/index.tsx:75`; `docs/release-checklists/learn-clinical-review-package.md:23`; `src/features/learn/content.ts:68` (A87, A94, L5) |
| 8 | **The developer "Reset onboarding" menu and three "Coming soon" rows** (Pitch Test, Rate app, Widgets) ship to users. | They look unfinished, and Pitch Test makes a medical-measurement claim (see L9). | `app/settings.tsx:170-178`; `app/(tabs)/more.tsx:111`, `:185`, `:254`, `:274` (A93, A175) |

## 2. Bugs users will hit

- **Editing an entry can move it to another day.** Any edit, even to the note alone, re-stamps the entry with the phone's *current* timezone. After travel, an old entry can jump to a different calendar day. The comment at that line says this shouldn't happen. `app/db/queries.ts:258-266`, `app/entry/[id].tsx:276` (A9, A12)
- **App Lock throws away whatever you were doing.** Each time the app goes to the background, the whole navigation tree is swapped for the lock screen. On Android that also happens during permission dialogs, the Play Billing sheet and file pickers. A half-filled entry is lost and you land back on Home. `app/_layout.tsx:61`, `app/contexts/AppLockContext.tsx:43` (A2, A7)
- **A cancelled Face ID or fingerprint prompt reopens straight away**, because the lock screen re-prompts every time the app becomes active. `app/components/LockScreen.tsx:59-62` (A38)
- **Double-tapping Save logs the entry twice.** Nothing blocks a second tap. `app/entry/new.tsx:307`, same in `[id].tsx` (A14, A50)
- **Deleting an entry stacks a second copy of the tab navigator** on top of the first instead of going back to it. `app/entry/[id].tsx:294-297` (A13)
- **The Trigger Impact row reads "N of N days"** whenever there's no estimate, which is always the case on the 7-day range. It compares entry counts with themselves, while the PDF shows the real day count. `app/(tabs)/trends.tsx:464`, `:469` (A6)
- **The Change tile can show a red "worse" arrow captioned "0%"** when last week averaged 0 ("None"). The arrow and the number come from two functions that disagree, and the code comment wrongly says the average can never be 0. `app/stats/sevenDayTrend.ts:325-341` (A16, A31)
- **Stats "All" isn't all.** Only the newest 1,000 entries are loaded, and Home uses 200, so the two screens and the PDF can disagree. `app/(tabs)/trends.tsx:1484`, `app/(tabs)/index.tsx:92` (A32-34, A96)
- **Stats and Home don't notice that a new day has started** if the app stays open past midnight, so they keep showing yesterday's window. `app/(tabs)/trends.tsx:1488`, `app/(tabs)/calendar.tsx:78` (A35, A98)
- **Deleting entries leaves orphan rows behind**, because SQLite foreign keys are never switched on. Custom triggers then show inflated usage counts and can never be deleted. `app/db/queries.ts:286-288`; there's no `PRAGMA foreign_keys` anywhere (A41-43)
- **The PDF disappears too early.** It's deleted as soon as the Android share chooser closes, so apps that read the file afterwards get nothing. On iOS the full backup JSON stays in the cache forever. `src/features/reports/reportExport.ts:19`; `app/my-data.tsx:163-175` (A54, A55, A52, A158)
- **Dark mode never follows the system on iOS** because `app.json` forces light mode. `app.json:9` (A28-30, A59)
- **If a database migration fails on start, the app crash-loops** with no report and no fallback screen, because there's no catch block and no error boundary. `app/_layout.tsx:96-106` (A36, A103)
- Smaller issues:
  - iOS date pickers never close: `app/entry/new.tsx:386` (A51)
  - Reminders get scheduled twice when toggled quickly: `app/utils/notifications.ts:117` (A111-112)
  - The reminder switch stays on after notification permission is refused: `app/reminders.tsx:58` (A173)
  - Leaving the entry form discards the draft without asking: `app/entry/new.tsx:344` (A168)
  - The "First pattern" milestone needs 90% while the screen states a pattern at 60%: `src/features/achievements/evaluate.ts:81` (A113)

## 3. Architecture and code quality

- **Copy-paste is now causing bugs.** The Add and Edit entry screens are two copies of about 450 lines each and have already drifted apart (Edit lost the info tooltips). `triggers.tsx` and `sound-types.tsx` are identical apart from renamed words. Six settings screens repeat the same roughly 230 lines, and `hexToRgba` is copied into 23 files. Pulling out one shared entry form, one list-manager screen and one single-choice screen would remove around 2,500 lines and stop the drift. `app/entry/[id].tsx:134`, `app/sound-types.tsx:1`, `app/settings.tsx:18` (A3, A4, A56, A57)
- **`trends.tsx` is 2,298 lines.** It mixes statistics, chart components and a 500-line stylesheet, and its memoisation recalculates on every tap because the label arrays are rebuilt on each render. It should be split into `stats/` functions, chart components and small card components. `app/(tabs)/trends.tsx:1497-1562` (A23, A24, A83)
- **There is no data layer.** 27 files call SQLite directly, each screen reloads on focus in its own way, and writes that touch several rows (save, edit, import) don't use transactions. A small repository or hook layer with transactions would fix the import, orphan-row and half-write problems together. `app/db/queries.ts:275`, `app/(tabs)/_layout.tsx:45` (A40, A95)
- **About 300 lines of dead code**: the "anchor check-in" system, which has its own table, a migration that runs on every launch, nine queries and notification code, but is never started. Either finish it or remove it. `app/utils/notifications.ts:73`, `app/db/queries.ts:23` (A25, A26, A58, A61)
- **The folder boundaries run both ways.** `src/features` imports from `app/` and `app/` imports from `src/features`, and helper modules under `app/` get registered as routes. `src/features/achievements/sync.ts:1` (A27)
- **Eight context providers** repeat the same settings boilerplate and are nested eight deep. One settings store would replace them. `app/contexts/ThemeContext.tsx:27` (A97)
- **The documentation is out of step with the code.** `AGENTS.md` is a stale copy that contradicts `CLAUDE.md`. Both say intensity runs 1–5 while the code uses 0–5. The README describes accounts and a backend that don't exist. `AGENTS.md:53`, `app/db/database.ts:30`, `README.md:35` (A116-118, A124)
- **Builds can silently miss config.** `npx expo run:android` doesn't regenerate the local, gitignored `android/` folder, so six config plugins may be missing from the build you test. `CLAUDE.md:9` (A22)

## 4. Design decisions worth revisiting

- **The paywall appears before the user has logged anything** (straight after the disclaimer). Show it after the first few entries instead. `app/onboarding/disclaimer.tsx:25` (A65)
- **The Switch control behaves two ways.** On Reminders it applies immediately; on Triggers and Sound Types it waits for Save, and Back throws the change away without warning. `app/triggers.tsx:104` (A67)
- **Calendar cells show a day's highest intensity while the charts show its average**, and nothing explains the difference. `app/(tabs)/calendar.tsx:301` (A137)
- **"Coverage %" in the PDF means two different things** depending on the selected range (6% versus 100% for the same diary). `src/features/reports/reportData.ts:89` (A142)
- **The 95% range can cross zero while the panel still names a direction** at 60% probability, which contradicts the in-app methodology guide. `app/(tabs)/trends.tsx:310-323`, `src/features/statistics/guide.ts:61` (A60, A82)
- **The model scales its prior using total variance rather than residual variance**, so the "prior SD 0.35" in the guide isn't what actually runs. `app/stats/triggerModel.ts:204` (A66)
- Smaller decisions:
  - The name is required in onboarding although it's only used in the greeting: `app/onboarding/name.tsx:61` (A141)
  - "Skip" doesn't skip anything extra: `app/onboarding/index.tsx:24` (A172)
  - iPad is declared as supported, but every layout is phone-width: `app.json:11` (A136)

## 5. Translations (28 languages advertised)

- **24 of the 27 translated languages are missing 135–174 of the 559 strings.** That covers the whole Trigger Impact card, Reports, Milestones and Learn, so those screens appear in English. `settings.on` is missing in all 27 (users see "Aus / On"). `app/app-lock.tsx:76`, `app/(tabs)/trends.tsx:539` (A18, A70, A72, A77)
- **Some English is hard-coded in components and never translated:** the six intensity labels on the entry form and "Cancel" and "OK" in every confirmation dialog. `app/entry/new.tsx:91`, `app/components/ConfirmDialog.tsx:58` (A19, A71-75)
- **Plurals are wrong in Slavic and Baltic languages.** Only `_one`/`_other` forms exist, and Hermes has no `Intl.PluralRules`. `app/i18n/index.ts:39` (A76)
- **Dates follow the phone's language while text follows the app's language**, which mixes languages on one screen. The PDF prints trigger names in English and numbers with a "." decimal point. `app/utils/datetime.ts:3`, `src/features/reports/reportHtml.ts:92` (A68, A69, A80, A81, A144)
- Indonesian is never picked automatically on Android (Android reports `in` rather than `id`), and support-directory country names are always in English. `app/contexts/LanguageContext.tsx:58`, `app/support-directory.tsx:25` (A39, A78)

## 6. Accessibility

- **Only one control in the whole app has a screen-reader label.** The add button, back buttons, edit and delete icons, and the intensity buttons are all announced as unnamed buttons. `app/(tabs)/_layout.tsx:40`, `:89`; `app/entry/new.tsx:65` (A20, A91, A167)
- **Text and icons have too little contrast.** Inactive tab icons and labels are 1.48:1 and muted text is 2.56:1, against a WCAG minimum of 4.5:1 for text. `app/(tabs)/_layout.tsx:112`, `app/constants/theme.ts:100-101` (A21)
- **Large system font sizes break the layout** because the boxes have fixed heights. Delete buttons are 24 pt, below the 44 pt minimum tap target. `app/(tabs)/index.tsx:415`, `app/reminders.tsx:139` (A92, A174)

## 7. Tooling and tests

- **The tests exist, but nothing can run them.** There's no test script and `tsx` isn't installed. One test is already failing because it expects 6 Learn guides and there are now 7. The calibration study prints FAIL but still exits as a success. `package.json:5`, `tests/features.validation.ts:64`, `tests/stats/calibration.test.ts:204` (A88-90, A160)
- **The riskiest logic has no tests at all:** migrations, local-day date maths, and import/export. `app/db/database.ts:117` (A85, A86)
- **There's no lint, typecheck or CI gate.** `tsc` passes today (I checked), but nothing enforces it. (A89)
- Hygiene items:
  - Unused `react-native-gifted-charts` and `@expo/vector-icons`: `package.json:41` (A131)
  - A deprecated Babel plugin: `babel.config.js:5` (A129)
  - `pulldb.sh` would drop a personal health database into the repo root with no `.gitignore` rule: `pulldb.sh:5` (A84)
  - About 3 MB of oversized onboarding images: `app/onboarding/index.tsx:22` (A155)

## 8. Legal and privacy (from v1, still open)

- **L1–L4** are in section 1 above (privacy policy, consent, empty subscription, seed data).
- **L6.** Android auto-backup uploads the unencrypted diary to Google Drive, which contradicts the policy's "stored locally". `app.json:18` has no `allowBackup` setting (A157). This is a one-line fix.
- **L7.** The disclaimers in the PDF and Learn fall back to English in 24 languages. The onboarding disclaimer was machine-translated without review.
- **L8.** The Play Data safety and App Store privacy labels must list Firebase, RevenueCat and EAS. Block the unused `AD_ID`, `SYSTEM_ALERT_WINDOW` and storage permissions. `app.json:18` (A156)
- **L9.** The positioning is sound **as long as** the app doesn't measure or diagnose. The planned "Pitch Test — identify your tinnitus frequency" would cross into medical-device territory (Play Health apps policy, Apple 1.4.1).
- **L11–L17.** Notification previews name the condition (`en.json:414`), and acceptance of the disclaimer isn't recorded.

## What already works well (keep it)

- The PDF is built on the device, notes are off by default, and the temporary file is cleaned up (only the timing is wrong).
- Analytics never receive symptom values.
- The disclaimer is shown during onboarding (once item 1 is fixed) and is always reachable from About.
- The statistics copy and the Learn guides are consistently honest: "association, not cause", "never stop medication", and a link to crisis services.
- The support directory is curated, with a non-endorsement notice and a written review procedure.

## Suggested order

1. **This week:** fix section 1 items 1, 3, 5, 6 and 8, add `allowBackup: false`, rewrite the privacy policy, and switch `paywall_enabled` off in Remote Config until premium actually unlocks something.
2. **Before the first public build:** fix the section 2 bugs, finish the strings for any language you advertise (or hide those languages), add accessibility labels and fix contrast, and add a `test` and `typecheck` script.
3. **Next refactor sprint:** do the section 3 work (shared entry form, split `trends.tsx`, a data layer with transactions, remove the anchor code).

*Not reviewed: native iOS and Android project files beyond the config, and runtime behaviour on a device (no builds were run, by request).*
