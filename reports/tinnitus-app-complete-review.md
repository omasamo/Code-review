# Tinnitus Tracker: complete review (all data in one document)

Reviewed: `main` at commit 5513c30, 5 to 6 October 2026. Nothing in the code was changed.

## How to read this

- **Part 1** is the final word. A council of four reviewers (release manager, React Native engineer, EU privacy counsel, user advocate) reviewed Part 2 independently, ranked each other anonymously, and a chair settled disagreements against the code. Where Part 1 corrects Part 2 or Part 3, Part 1 wins.
- **Part 2** is the full review, ordered by severity, grouped into blockers, bugs, architecture, design decisions, translations, accessibility, tooling and legal.
- **Part 3** is the first legal and privacy pass, with sources (store policies, GDPR, FDA). Its items are referenced in Part 2 as L1 to L17.
- **Part 4** is the evidence for every finding: file and line, the code checked, what goes wrong, the suggested fix, and how many of three independent verifiers upheld it. Items are referenced elsewhere as A1 to A178.

## Contents

1. Council verdict (v3)
2. Full review (v2)
3. Legal and privacy review (v1)
4. Evidence appendix


---

# Part 1. Council verdict (v3, latest and authoritative)

### 1. Verdict

The app is not ready for public release at commit 5513c30, but it is close. The council (A release, B engineer, C privacy, D user) agrees that the core diary, stats and PDF work is solid and that analytics never carry symptom values. The blockers are mostly about configuration and launch scope, not engineering. All four seats put the same item first: fake "Alex" data is seeded on every install, and that seeding also skips the medical disclaimer (app/db/database.ts:104, :290-292). The council also agrees on four more points:
- Ship v1 free.
- Hide content that has not been reviewed.
- Make telemetry opt-in.
- Fix backup import and App Lock before launch.

The first launch is Android-only (eas.json:24-29 submits to the "internal" track). So Google Play policy and EU law matter more for v1 than Apple's rules.

### 2. Final top 10

1. **Remove the dev seed data.** `seedDevData()` runs on every install. It writes 15 invented entries and the name "Alex", and it sets `onboarding_completed`, so no user ever sees the disclaimer (app/db/database.ts:104, :290-292; A1, A8). Testers who already have seeded data must reinstall. *Top 5 for: A, B, C, D.*
2. **Stop selling a subscription that unlocks nothing, in code.** Ship it together with #1, because once #1 is fixed every new user reaches the onboarding paywall (app/onboarding/disclaimer.tsx:25-26). Three changes: set both flag defaults to false (app/utils/remoteConfig.ts:6-9), remove the More > Subscription row, which opens the paywall without checking any flag (app/(tabs)/more.tsx:262), and drop the "Unlimited entries" copy (en.json:146; L3). *Top 5 for: A, C, D.*
3. **Make analytics and crash reporting opt-in, switched off natively until the user agrees.** Today firebase.json only contains `crashlytics_debug_enabled`. Add `analytics_auto_collection_enabled`, `google_analytics_adid_collection_enabled`, `crashlytics_auto_collection_enabled` and `perf_auto_collection_enabled`, all set to false. Also send route patterns instead of raw paths like /learn/medicines (app/_layout.tsx:57-59; L2, A150). *Top 5 for: A, C.*
4. **Rewrite the privacy policy to match the app.** Then fill in Play's Data safety form and Health apps declaration from the same list of data flows, and link the policy from onboarding. The current policy describes a different app (app/about.tsx:95; L1, L8). *Top 5 for: A, C.*
5. **Cut launch scope instead of waiting on reviewers.**
   - Remove the developer menu (app/settings.tsx:170-178) and the "coming soon" rows, especially Pitch Test.
   - Hide the Learn section, or at least its unreviewed guides, until a clinician signs off. It currently says "Clinical review required before release" (en.json:299; A87, A93, A94).
   - Offer only en/de/es/fr. The other 24 languages are missing 135-174 keys each, including disclaimers (A18, L7).

   *Top 5 for: A, D.*
6. **Make backup import safe.** Check each row, run the whole import as one transaction (so it fully succeeds or changes nothing), and skip duplicates. An intensity of 8 crashes Stats every time it opens: trends.tsx:89 counts into a 6-slot array and :127 then breaks on the gap. A bad date aborts the import halfway through and leaves the rows already written (app/db/queries.ts:334-345; A10, A11, A15). *Top 5 for: B.*
7. **Fix App Lock so it stops throwing work away.** It replaces the whole navigator instead of covering it (app/_layout.tsx:61). It also re-locks on any "background" event (app/contexts/AppLockContext.tsx:43-44), which Android fires for the file picker, the document picker and Play billing. Show the lock as a full-screen modal that blocks the back button, and add a short grace period (A2, A7, A38). *Top 5 for: B.*
8. **Protect entries, and stop one bad row from bricking the app.**
   - Guard Save against double taps (app/entry/new.tsx:307).
   - On edit, only re-date the entry when the date actually changed (app/entry/[id].tsx:276).
   - Delete linked rows inside a transaction.
   - Catch startup errors: `initDatabase()` has only `finally`, no `catch` (app/_layout.tsx:96-106).
   - Add an error boundary, a screen that catches crashes and offers recovery (A9, A14, A36, A50).

   *Top 5 for: B.*
9. **Lock down native config before the first public build.**
   - Change `runtimeVersion` to the "fingerprint" policy (app.json:76-78; A5). Today an over-the-air update could reach older builds that lack its native code.
   - Make an explicit Android backup decision.
   - Set `supportsTablet` to false (app.json:11).
   - Build the release candidate with EAS, because the local android/ folder is stale and still has `allowBackup="true"` (AndroidManifest.xml:14; A156, A157).

   *Top 5 for: B.*
10. **Add red-flag safety guidance where users log symptoms.** Advice about sudden hearing loss or pulsing tinnitus appears in only one Learn guide (src/features/learn/content.ts:82). Show a calm prompt when a user logs those symptoms, and add one urgent-care sentence to the disclaimer. *Top 5 for: D.*

### 3. What changed from v2

**Corrected**
- *Turn `paywall_enabled` off in Remote Config* (v2, Suggested order). This does not stop the sale. The in-code defaults are true (remoteConfig.ts:6-9) and apply on an offline first launch, and the More row ignores the flag (more.tsx:262). The fix now lives in code (item 2).
- *Consent framed around Apple 5.1.1 with "opt-in or at least opt-out"* (v2 §1 #3). Now prior opt-in, set natively. No code calls `setAnalyticsCollectionEnabled` (grep finds nothing), so a toggle in Settings alone would come too late.
- *"An intensity of 8 can crash Stats or Home"* (v2 §1 #6). It crashes Stats only. Home survives because `intensityColor` clamps the value (app/constants/theme.ts:4-6). A bad date aborts the import in `computeLocalDate` (queries.ts:341-342), so it never reaches Home.
- *A failed migration crash-loops "with no report"* (A36). Crashlytics starts before the database code (app/_layout.tsx:87 vs :96), so the raw crash is reported. What is missing is a recovery path.
- *`allowBackup: false` as a one-line fix this week* (L6, A157). Re-rated as a decision to make, not a blocker. Backup is currently the only full restore path, because import drops data (A15, A17). An app.json change also does not reach the stale local manifest (AndroidManifest.xml:14).
- *A20: intensity buttons are unnamed.* Narrowed. They have visible text labels but no role or selected state (app/entry/new.tsx:65-91; A167). The add button really is unlabeled, and the whole app has exactly one `accessibilityLabel` (grep count = 1).

**Re-ranked**
- Apple citations move behind Play policy and EU law, because purchases are Android-only (app/utils/purchases.ts:14-16).
- OTA safety (A5) stays a must-fix but is not urgent, since builds go only to the internal track (eas.json:24-29).
- Moved down to after launch:
  - the 1,000-entry Stats cap and midnight staleness (A32-35, trends.tsx:1484);
  - stats-model internals (A66, A142);
  - merging the eight settings providers (A97).
- Missing transactions no longer wait on a data-layer refactor (v2 §3). About 40 lines in queries.ts fix them now.

**New findings**
- Fixing the seed data exposes the empty paywall to every user (database.ts:292; disclaimer.tsx:25-26).
- Firebase collects data natively before any JavaScript runs (firebase.json).
- Delete All Data leaves the analytics ID in place: there is no `resetAnalyticsData` anywhere in app/ or src/.
- Play launch gates are missing from the checklist: Health apps declaration, Data safety, and possibly closed testing (A).
- The release candidate must come from an EAS build, not a local `run:android` (A156).
- Red-flag guidance is not shown at logging time (content.ts:82).
- EU medical-device claims need care. Medicine triggers are seeded (database.ts:220-222) next to the "identify triggers" and "what brings relief" copy (en.json:552, :557).
- With App Lock on, a user can re-run an import whose result screen was lost, which duplicates entries (B; my-data.tsx:192-211).

### 4. Where the council disagreed, and the chair's call

- **Seed data or consent first?** C put consent first. Decision: seed data first. It is a one-line fix that also hides the disclaimer from every user. Consent is #3.
- **Remote Config flip (D) vs code change (A, C).** Code change. I confirmed more.tsx:262 opens the paywall without a flag check and that remoteConfig.ts:6-9 defaults both flags to true.
- **Opt-out (D) vs opt-in (A, B, C).** Opt-in. Whether these events count as health data (C's Art. 9 argument) is debatable. But opt-in costs little and is the only safe reading. C named the Perf key wrong: the correct key is `perf_auto_collection_enabled`, which I checked against node_modules/@react-native-firebase.
- **Android backup.** It is not a launch blocker. Decide on backup after the import fix (#6) lands, and disclose it in the privacy policy.
- **Learn line number.** The Learn footer is at en.json:299, not :260 as C cited.
- **Finish reviews or cut scope?** Cut (A). The repo's own gate requires clinical review "before publishing Learn", not before publishing the app (docs/release-checklists/health-content-and-privacy.md:3-4).
- **Medical-device question (C).** Write a short memo and tighten the claims before launch. This is not a launch blocker, because the app frames results as associations, not diagnoses (content.ts:73).
- **Lock screen as an overlay or a Modal?** A Modal with back-button handling (B). A plain overlay still lets the hardware back button and TalkBack, the Android screen reader, reach the screen underneath (LockScreen.tsx has no BackHandler).

### 5. Plan

**This week**
- Items 1 and 2, shipped together. Then reinstall on every test device.
- Item 5: remove the dev and coming-soon UI, hide Learn, and limit the language list.
- Item 9: switch runtimeVersion to fingerprint and set supportsTablet to false.

**Before launch**
- Items 3, 4, 6, 7, 8 and 10.
- Add `test` and `typecheck` scripts and fix the stale guide-count test (tests/features.validation.ts:64; A85-90).
- Smoke-test an EAS production build on a real device, then roll out in stages: internal, closed, production.

**Later**
- Clinical and native-speaker review, then re-enable Learn and the other languages.
- Decide what premium unlocks.
- iOS as a separate project (no bundleIdentifier at app.json:10-12, no Firebase plist).
- Accessibility and reduce-motion pass.
- The 1,000-entry cap.
- Refactors (v2 §3).

---

# Part 2. Full review (v2)

Covers `main` at commit 5513c30 (2026-10-05). Nothing in the repo was changed.

**How this was checked.** Eleven reviewers each read one area of the app line by line: data, entry forms, home and calendar, stats, app lifecycle, features, architecture, design, security, translations, and tooling. Every issue they raised then went to three separate checkers. One traced the code path, one judged the real user impact, and one tried to prove the issue wrong. An issue stays only if at least two of the three agreed. A further round looked for gaps. That process left **178 confirmed issues**. Several were found by more than one reviewer, so they collapse to about 110 distinct problems. I also re-read the most serious ones in the code myself. Every item below gives its file and line, plus an `A#` number that points to the full evidence in the **appendix** (`tinnitus-app-review-v2-evidence.md`). The legal and privacy findings from v1 are folded in and marked **L#**.

**In one paragraph:** the product thinking is strong. The statistics are careful, the language is honest about association versus cause, the diary is local-first, and the PDF is privacy-aware. The problems come from fast growth. Release-only safeguards were left switched off, data moves in and out without validation, a few date and timezone paths contradict their own comments, the same code has been copy-pasted until the copies drift apart, translations are far from finished, and nothing runs the tests. None of it is hard to fix, but the first block has to be fixed before any public release.

---

### 1. Must fix before release

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

### 2. Bugs users will hit

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

### 3. Architecture and code quality

- **Copy-paste is now causing bugs.** The Add and Edit entry screens are two copies of about 450 lines each and have already drifted apart (Edit lost the info tooltips). `triggers.tsx` and `sound-types.tsx` are identical apart from renamed words. Six settings screens repeat the same roughly 230 lines, and `hexToRgba` is copied into 23 files. Pulling out one shared entry form, one list-manager screen and one single-choice screen would remove around 2,500 lines and stop the drift. `app/entry/[id].tsx:134`, `app/sound-types.tsx:1`, `app/settings.tsx:18` (A3, A4, A56, A57)
- **`trends.tsx` is 2,298 lines.** It mixes statistics, chart components and a 500-line stylesheet, and its memoisation recalculates on every tap because the label arrays are rebuilt on each render. It should be split into `stats/` functions, chart components and small card components. `app/(tabs)/trends.tsx:1497-1562` (A23, A24, A83)
- **There is no data layer.** 27 files call SQLite directly, each screen reloads on focus in its own way, and writes that touch several rows (save, edit, import) don't use transactions. A small repository or hook layer with transactions would fix the import, orphan-row and half-write problems together. `app/db/queries.ts:275`, `app/(tabs)/_layout.tsx:45` (A40, A95)
- **About 300 lines of dead code**: the "anchor check-in" system, which has its own table, a migration that runs on every launch, nine queries and notification code, but is never started. Either finish it or remove it. `app/utils/notifications.ts:73`, `app/db/queries.ts:23` (A25, A26, A58, A61)
- **The folder boundaries run both ways.** `src/features` imports from `app/` and `app/` imports from `src/features`, and helper modules under `app/` get registered as routes. `src/features/achievements/sync.ts:1` (A27)
- **Eight context providers** repeat the same settings boilerplate and are nested eight deep. One settings store would replace them. `app/contexts/ThemeContext.tsx:27` (A97)
- **The documentation is out of step with the code.** `AGENTS.md` is a stale copy that contradicts `CLAUDE.md`. Both say intensity runs 1–5 while the code uses 0–5. The README describes accounts and a backend that don't exist. `AGENTS.md:53`, `app/db/database.ts:30`, `README.md:35` (A116-118, A124)
- **Builds can silently miss config.** `npx expo run:android` doesn't regenerate the local, gitignored `android/` folder, so six config plugins may be missing from the build you test. `CLAUDE.md:9` (A22)

### 4. Design decisions worth revisiting

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

### 5. Translations (28 languages advertised)

- **24 of the 27 translated languages are missing 135–174 of the 559 strings.** That covers the whole Trigger Impact card, Reports, Milestones and Learn, so those screens appear in English. `settings.on` is missing in all 27 (users see "Aus / On"). `app/app-lock.tsx:76`, `app/(tabs)/trends.tsx:539` (A18, A70, A72, A77)
- **Some English is hard-coded in components and never translated:** the six intensity labels on the entry form and "Cancel" and "OK" in every confirmation dialog. `app/entry/new.tsx:91`, `app/components/ConfirmDialog.tsx:58` (A19, A71-75)
- **Plurals are wrong in Slavic and Baltic languages.** Only `_one`/`_other` forms exist, and Hermes has no `Intl.PluralRules`. `app/i18n/index.ts:39` (A76)
- **Dates follow the phone's language while text follows the app's language**, which mixes languages on one screen. The PDF prints trigger names in English and numbers with a "." decimal point. `app/utils/datetime.ts:3`, `src/features/reports/reportHtml.ts:92` (A68, A69, A80, A81, A144)
- Indonesian is never picked automatically on Android (Android reports `in` rather than `id`), and support-directory country names are always in English. `app/contexts/LanguageContext.tsx:58`, `app/support-directory.tsx:25` (A39, A78)

### 6. Accessibility

- **Only one control in the whole app has a screen-reader label.** The add button, back buttons, edit and delete icons, and the intensity buttons are all announced as unnamed buttons. `app/(tabs)/_layout.tsx:40`, `:89`; `app/entry/new.tsx:65` (A20, A91, A167)
- **Text and icons have too little contrast.** Inactive tab icons and labels are 1.48:1 and muted text is 2.56:1, against a WCAG minimum of 4.5:1 for text. `app/(tabs)/_layout.tsx:112`, `app/constants/theme.ts:100-101` (A21)
- **Large system font sizes break the layout** because the boxes have fixed heights. Delete buttons are 24 pt, below the 44 pt minimum tap target. `app/(tabs)/index.tsx:415`, `app/reminders.tsx:139` (A92, A174)

### 7. Tooling and tests

- **The tests exist, but nothing can run them.** There's no test script and `tsx` isn't installed. One test is already failing because it expects 6 Learn guides and there are now 7. The calibration study prints FAIL but still exits as a success. `package.json:5`, `tests/features.validation.ts:64`, `tests/stats/calibration.test.ts:204` (A88-90, A160)
- **The riskiest logic has no tests at all:** migrations, local-day date maths, and import/export. `app/db/database.ts:117` (A85, A86)
- **There's no lint, typecheck or CI gate.** `tsc` passes today (I checked), but nothing enforces it. (A89)
- Hygiene items:
  - Unused `react-native-gifted-charts` and `@expo/vector-icons`: `package.json:41` (A131)
  - A deprecated Babel plugin: `babel.config.js:5` (A129)
  - `pulldb.sh` would drop a personal health database into the repo root with no `.gitignore` rule: `pulldb.sh:5` (A84)
  - About 3 MB of oversized onboarding images: `app/onboarding/index.tsx:22` (A155)

### 8. Legal and privacy (from v1, still open)

- **L1–L4** are in section 1 above (privacy policy, consent, empty subscription, seed data).
- **L6.** Android auto-backup uploads the unencrypted diary to Google Drive, which contradicts the policy's "stored locally". `app.json:18` has no `allowBackup` setting (A157). This is a one-line fix.
- **L7.** The disclaimers in the PDF and Learn fall back to English in 24 languages. The onboarding disclaimer was machine-translated without review.
- **L8.** The Play Data safety and App Store privacy labels must list Firebase, RevenueCat and EAS. Block the unused `AD_ID`, `SYSTEM_ALERT_WINDOW` and storage permissions. `app.json:18` (A156)
- **L9.** The positioning is sound **as long as** the app doesn't measure or diagnose. The planned "Pitch Test — identify your tinnitus frequency" would cross into medical-device territory (Play Health apps policy, Apple 1.4.1).
- **L11–L17.** Notification previews name the condition (`en.json:414`), and acceptance of the disclaimer isn't recorded.

### What already works well (keep it)

- The PDF is built on the device, notes are off by default, and the temporary file is cleaned up (only the timing is wrong).
- Analytics never receive symptom values.
- The disclaimer is shown during onboarding (once item 1 is fixed) and is always reachable from About.
- The statistics copy and the Learn guides are consistently honest: "association, not cause", "never stop medication", and a link to crisis services.
- The support directory is curated, with a non-endorsement notice and a written review procedure.

### Suggested order

1. **This week:** fix section 1 items 1, 3, 5, 6 and 8, add `allowBackup: false`, rewrite the privacy policy, and switch `paywall_enabled` off in Remote Config until premium actually unlocks something.
2. **Before the first public build:** fix the section 2 bugs, finish the strings for any language you advertise (or hide those languages), add accessibility labels and fix contrast, and add a `test` and `typecheck` script.
3. **Next refactor sprint:** do the section 3 work (shared entry form, split `trends.tsx`, a data layer with transactions, remove the anchor code).

*Not reviewed: native iOS and Android project files beyond the config, and runtime behaviour on a device (no builds were run, by request).*

---

# Part 3. Legal and privacy review (v1)

Scope: the app positions itself as a wellness/self-tracking product, not a regulated health app. This checks whether the code, copy, live legal pages and store setup actually hold that line, then widens to quality and UX items that affect release. File references are relative to the repo; `en.json` = `app/i18n/locales/en.json`.

**Verdict in one line:** the in-app positioning (disclaimers, "association not cause" framing, on-device data) is well done; the gaps are around what is *actually collected and sold* versus what the privacy policy, paywall and stores are told.

---

### Critical

#### 1. The live privacy policy does not describe the app that ships
`app/about.tsx:95` links `https://kappsa.tech/Privacy-Policy/`. Checked live today, it:
- covers an app called **"TinnitusTrack"**; the app is "Tinnitus Tracker" (`app.json:3`);
- says the app collects **Age** — nothing collects age (onboarding asks only a name: `app/onboarding/name.tsx`);
- lists **Google AdMob** — no ads SDK is installed (`package.json:14–43`);
- omits **Crashlytics** (`app/utils/crashlytics.ts`), **Performance Monitoring** (`app/utils/performance.ts`), **Remote Config** (`app/utils/remoteConfig.ts`) and **EAS Updates**, which contacts `u.expo.dev` on every launch (`app.json:84–87`);
- says uninstalling "will permanently remove all data", which is false while Android Auto Backup is on (see #6).

Apple 5.1.1(i) requires the policy to "identify what data, if any, the app/service collects, how it collects that data, and all uses of that data" ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/#privacy)). Google requires "a comprehensive and accurate privacy policy" for health apps ([Play Health apps policy](https://support.google.com/googleplay/android-developer/answer/12991134)) and holds you responsible for Data safety accuracy "including data collected and handled through any third-party libraries or SDKs" ([Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)). An inaccurate policy is the most common rejection reason and the easiest to fix.

#### 2. Analytics, crash and performance telemetry start on launch with no consent and no opt-out
`app/_layout.tsx:87–88` initialises Crashlytics and Remote Config before any screen renders; `app/_layout.tsx:57–59` logs a screen view on every route change; Crashlytics collection is on in release (`app/utils/crashlytics.ts:16`). There is no consent prompt and no settings toggle (CLAUDE.md backlog already notes the missing opt-out).

Apple 5.1.1(ii): "Apps that collect user or usage data must secure user consent for the collection, even if such data is considered to be anonymous… Apps must also provide the customer with an easily accessible and understandable way to withdraw consent." The company is Slovak (Terms: governing law Slovakia), so GDPR/ePrivacy apply to EU users; the live policy names "consent" as a legal basis but none is obtained. Note also that screen-view paths such as `/learn/medicines` reveal which health guides a user reads (`app/_layout.tsx:58`).

Fix: a one-screen opt-in (or at least an opt-out) in onboarding + Settings > Privacy wired to `setAnalyticsCollectionEnabled` / `setCrashlyticsCollectionEnabled`, and list every SDK in the policy.

#### 3. The subscription sells features that do not exist
`app/(tabs)/more.tsx:102–103` advertises "Unlock Premium — Unlimited entries, full reports & more". `isSubscribed` is read only in `app/(tabs)/more.tsx:122,150,262–264` to swap banner/row labels; nothing else in `app/` or `src/` reads it, so a paying user gets nothing (CLAUDE.md: "Premium still gates nothing"). The paywall is also pushed into onboarding before any value is shown (`app/onboarding/disclaimer.tsx:25–26`).

Apple 3.1.2(a): "you must provide ongoing value to the customer". Google treats paid features that do not exist as deceptive. In the EU this is a straightforward unfair-commercial-practice/refund exposure. Until premium is defined, flip `paywall_enabled` and `promo_banner_enabled` off in Remote Config (`app/utils/remoteConfig.ts:6–9`) or gate something real.

#### 4. Fake health data is written into every fresh install
`app/db/database.ts:104` calls `seedDevData()` unconditionally; it inserts 15 fabricated symptom entries and sets the user's name to "Alex" (`app/db/database.ts:291`), so a new user sees "Good morning, Alex" and invented tinnitus history, which also flows into the doctor PDF (`src/features/reports/reportData.ts`). Apple 5.1.3(ii): apps "must not write false or inaccurate data into… health management apps". The Settings "Developer" section with "Reset Onboarding" is likewise unguarded by `__DEV__` (`app/settings.tsx:170–178`). Both are marked "TODO: remove before release" but are on `main`.

---

### High

#### 5. Learn content ships while still flagged as clinically unreviewed
`en.json:260` renders in-app: "Content updated August 2026 · Clinical review required before release". `docs/release-checklists/learn-clinical-review-package.md` states "independent clinical and language sign-off pending" and `docs/release-checklists/health-content-and-privacy.md` makes that a blocking gate. The medicines guide names drug classes (aspirin, NSAIDs, antibiotics, diuretics, cancer treatments — `src/features/learn/content.ts:71`), which is exactly the content Apple 1.4.1 reviews "with greater scrutiny". Either complete the review or hide the Learn section behind the existing Remote Config pattern until it is done.

#### 6. Android backs up the unencrypted symptom database to Google Drive by default
`app.json` sets no `android.allowBackup`; Expo's default is `true`: "Allows your user's app data to be automatically backed up to their Google Drive… set to false… if your app deals with sensitive information" ([Expo config reference](https://docs.expo.dev/versions/latest/config/app/)). The DB is plain SQLite (`app/db/database.ts:4`). Under GDPR Art. 4(15) a tinnitus diary is "data concerning health" whatever the product positioning ([Art. 4 GDPR](https://gdpr-info.eu/art-4-gdpr/)), so this is a silent off-device transfer the policy denies ("stored locally on your device"). Set `"android": { "allowBackup": false }` or disclose it. App Lock protects the UI only, not the file.

#### 7. Legal and safety text falls back to English in 24 of 28 languages
`learn.disclaimerBody`, `learn.updated` and `reports.pdf.disclaimer` exist only in en/de/es/fr; the other 24 locale files lack them (checked programmatically; `fallbackLng: 'en'` at `app/i18n/index.ts:71`). A Polish or Czech user's doctor PDF therefore carries an English "Important limitation" box. Separately, the medical disclaimer shown at onboarding (`en.json:477`) was machine-translated into all 27 other locales without review (CLAUDE.md, session 2026-09-12). Disclaimer and consent copy should be the first thing a native/legal reviewer signs off, before the long tail of UI strings.

#### 8. Store disclosures cannot be verified from the repo and must match #1
Play Data safety and Apple privacy labels need: Firebase Analytics (app interactions, device/app IDs), Crashlytics (crash logs, device info), Performance, RevenueCat (purchase history + anonymous app user ID — `app/utils/purchases.ts:24–25`), EAS Updates (runtime/device headers). The release checklist only mentions App Store Connect answers, not Play's form. Firebase Analytics on Android pulls in the `AD_ID` permission by default; since the app serves no ads, block it (`android.blockedPermissions: ["com.google.android.gms.permission.AD_ID"]`) or set `google_analytics_adid_collection_enabled=false`, and answer "no advertising ID" in Data safety. I could not confirm the merged manifest locally (no build output present), so verify on the next build.

---

### Medium

#### 9. "Wellness, not health" is only partly true, and one planned feature would break it
- GDPR: the data *is* health data (see #6); positioning changes nothing there. Local-only storage is what keeps this manageable — keep it that way and say so.
- US: FDA's general-wellness safe harbour requires software "unrelated to the diagnosis, cure, mitigation, prevention, or treatment of a disease or condition" ([FDA General Wellness guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices)). A tinnitus-named symptom diary is not in that bucket; it relies instead on being a low-risk record-keeping tool. That holds as long as the app does not measure, diagnose or recommend treatment.
- The "Pitch Test — Identify your tinnitus frequency" row (`app/(tabs)/more.tsx:183–185`, `en.json:112–113`) is a measurement claim. Google: "Apps performing diagnosis, treatment recommendations, or clinical monitoring may qualify as Software as a Medical Device" ([Play Health apps policy](https://support.google.com/googleplay/android-developer/answer/12991134)); Apple 1.4.1 rejects unvalidated measurement claims. Decide the regulatory position before building it, or drop the row.
- Trigger Impact is the closest existing feature to "providing information for medical decisions"; its framing as association with explicit uncertainty (`en.json:68`, `src/features/statistics/guide.ts:105–106`, PDF disclaimer `en.json:252`) is the right defence. Keep that wording under change control.

#### 10. Subscription terms live in the RevenueCat dashboard, not the repo
`app/paywall.tsx:13–14,67` renders the remote paywall; price, period, trial conversion, auto-renewal and links to Terms/Privacy must be on it (Apple 3.1.2(c) and Schedule 2; Google subscriptions policy). The live Terms page does cover auto-renewal and trial conversion, which is good; confirm the paywall template shows the same before submission.

#### 11. Accessibility
Only 1 `accessibilityLabel` across 99 `PressableScale` uses; the 28 icon-only back buttons (e.g. `app/about.tsx:64–66`) announce nothing to TalkBack/VoiceOver. Contrast (computed): `textMuted #94A3B8` on white = **2.56:1**, `textFaint #CBD5E1` = **1.48:1** (`app/constants/theme.ts:100–101`); WCAG AA needs 4.5:1 for body text, and `textMuted` is used in 75 places, often at 11–13 px (e.g. `app/about.tsx:262–267`). Dark theme is better but `textMuted` still 3.73:1. The European Accessibility Act applies to consumer apps selling services in the EU since June 2025 ([Directive 2019/882](https://eur-lex.europa.eu/eli/dir/2019/882/oj)).

---

### Low

12. **Lock-screen notifications name the condition**: "Time to log how your tinnitus is doing today." (`en.json:414`) under the title "Tinnitus Tracker" (`en.json:411`); App Lock does not cover notification previews. Offer a neutral wording option.
13. **Tests never run**: `tests/` has real validation files but `package.json:5–10` has no test script or runner; nothing in CI. `npx tsc --noEmit` passes today (exit 0) — put that and the tests in a script.
14. **Startup crash path**: `app/_layout.tsx:96–106` wraps `initDatabase()` in try/finally with no catch and there is no error boundary in `app/`; a failed migration on upgrade is a white screen with no report.
15. **Native UI theme**: `app.json:9` `userInterfaceStyle: "light"` while the app has a dark theme, so system dialogs, date pickers and share sheets render light inside dark mode. Use `"automatic"`.
16. **Repo hygiene that can leak into store copy**: `README.md` describes account creation and a Node/Express backend that do not exist; `pulldb.sh` and `prompt.txt` are dev artefacts; `app.json` has no `ios.bundleIdentifier`; `app/updates.tsx` still has a placeholder App Store id (backlog).
17. **Disclaimer acknowledgement is not recorded**: "I Understand" only completes onboarding (`app/onboarding/disclaimer.tsx:25–30`). Storing `disclaimer_accepted_at` + text version is cheap evidence if ever asked.

---

### What already holds up (no action)
- PDF reports are built on-device and the temp file is deleted after the share sheet (`src/features/reports/reportExport.ts:16–20`); notes are off by default (`app/reports.tsx:27`, `en.json:213`).
- No symptom values reach analytics: only counts/booleans in every `logEvent` call (`app/utils/analytics.ts:7–8`; calls in `app/entry/new.tsx:332`, `app/my-data.tsx:175`, etc.).
- Medical disclaimer is unskippable at onboarding (Skip goes to the name step, `app/onboarding/index.tsx:72–73`, which leads to the disclaimer) and is permanently reachable under About > Legal (`app/about.tsx:104–111`).
- Learn and stats consistently say association ≠ causation, never advise stopping medication (`src/features/learn/content.ts:37,73,81`), and point to emergency services for self-harm risk (`content.ts:55`).
- Support directory carries a non-endorsement and "not emergency care" notice (`en.json:154`) with a documented review procedure (`docs/release-checklists/support-directory.md`).
- Terms of Service exist, name governing law, auto-renewal and trial conversion (live page checked today).
- App Lock is OS-driven biometrics/passcode, no home-grown PIN (`app/utils/appLock.ts`).

### Suggested order
1 → 2 → 3/4 (one afternoon each) are release blockers for both stores; 5–8 before the first public build; 9 is a decision, not code; 11–17 are backlog.

---

# Part 4. Evidence appendix: all 178 verified findings

All 178 findings that survived verification. Each was raised by one reviewer, then checked independently by three verifiers (reproduce in code, judge user impact, try to refute); a finding is listed only if at least two of the three upheld it. Severity is the median verifier opinion. Several findings were raised by more than one reviewer and appear more than once; the main report merges them.

Severity: critical = data loss/crash/wrong health data; high = user-visible bug or serious structural debt; medium = real but contained; low = polish.

### A1. [CRITICAL · bug] Dev seed data runs on every fresh install and skips onboarding + medical disclaimer
**Where:** `app/db/database.ts:104`  ·  **Verifiers upholding:** 3/3

**What:** initDatabase() unconditionally calls seedDevData() (app/db/database.ts:104) with no __DEV__ guard; on every fresh install it inserts 15 fabricated entries, sets name='Alex' and onboarding_completed='true' (lines 290-292), which OnboardingContext.tsx:17 and _layout.tsx:66-75 use to skip onboarding, name entry and the medical disclaimer and show the fake data as the user's real health history.

**Evidence:** app/db/database.ts:105 `seedDevData(); // TODO: remove before release`; :243-247 guard is only `SELECT value FROM settings WHERE key = 'dev_seeded'` (true on every first launch); :291-293 `INSERT INTO settings ... ('dev_seeded','1')`, `INSERT OR IGNORE ... ('name','Alex')`, `INSERT OR IGNORE ... ('onboarding_completed','true')`. `grep -rn __DEV__ app src` hits only app/utils/*. app/_layout.tsx:67-75 gates onboarding purely on `completed`, so a seeded install routes straight to (tabs).

**What goes wrong:** A real user installs the release build -> Home greets 'Good morning, Alex', Home/Stats/Calendar/Reports/PDF export show 15 fake entries as the user's own health history, and the onboarding slides, name entry and medical disclaimer are never shown. The same seeded rows are exported into backups and fed into the Trigger Impact model.

**Suggested fix:** Wrap the call in `if (__DEV__)` today and delete seedDevData() (and the `dev_seeded` key) before release; add a release-checklist grep for `seedDevData` / `TODO: remove before release`.

### A2. [HIGH · architecture] App Lock re-lock unmounts the entire navigator, losing navigation and form state
**Where:** `app/_layout.tsx:61`  ·  **Verifiers upholding:** 3/3

**What:** AppShell returns <LockScreen /> instead of the <Stack> whenever App Lock re-locks (every AppState 'background', which on Android fires for any paused Activity incl. permission dialogs, Play Billing and pickers), so the navigator and all screen state (entry draft, paywall mid-purchase) are unmounted and the app restarts at Home after unlocking.

**Evidence:** app/_layout.tsx:61 `if (completed && enabled && !unlocked) return <LockScreen />;` — the `<Stack>` at :64-79 is a sibling return, not a parent, so it unmounts. app/contexts/AppLockContext.tsx:43-44 `if (nextState === 'background' && enabledRef.current) { setUnlocked(false); }`. The mitigation comment at AppLockContext.tsx:34-37 ("'inactive' also fires transiently for ... system dialogs") describes iOS semantics; on Android, RN emits only 'active'/'background' and any paused Activity (runtime-permission dialog, Play Billing sheet, SAF/document picker, share chooser) fires 'background'. CLAUDE.md states the add screen deliberately keeps form state across navigation — that guarantee is void under lock.

**What goes wrong:** App Lock enabled. (a) User is on entry/new with a half-typed note, switches apps, comes back, unlocks → Stack remounts at `index` → Redirect to /(tabs) Home; the draft and the stack are gone. (b) On Reminders, user flips the switch → `ensureNotificationPermission()` (app/reminders.tsx:62) opens the Android 13 permission dialog → host Activity pauses → 'background' → lock screen replaces the Stack → after granting and unlocking the user lands on Home, not Reminders. (c) On the paywall opened from More (app/paywall.tsx:67-76), `launchBillingFlow` pauses the Activity → the RevenueCatUI.Paywall unmounts mid-purchase; `onPurchaseCompleted`/`finish()` never run for that mount (entitlement is only picked up via SubscriptionContext's listener).

**Suggested fix:** Render LockScreen as an overlay on top of the Stack (e.g. `<>{stack}{locked && <LockScreen style={StyleSheet.absoluteFill}/>}</>` or a full-screen Modal) instead of replacing it, so navigation and screen state survive. Additionally consider not re-locking when the pause was caused by an in-app-initiated system Activity (set a 'suppressNextBackground' ref around permission requests, pickers and purchases), or add a short grace period before locking.

### A3. [HIGH · architecture] Add and Edit screens are ~450-line copies of each other and have already diverged
**Where:** `app/entry/[id].tsx:134`  ·  **Verifiers upholding:** 3/3

**What:** Add (app/entry/new.tsx) and Edit (app/entry/[id].tsx) each carry private copies of ScaleSelector, SegmentedControl, Chip, FieldCard, the header/date pickers, date-combining logic and makeStyles; the copies have already diverged — Edit's FieldCard ([id].tsx:134) has no tooltip prop and the file never imports InfoModal, so the per-field ⓘ explainers (new.tsx:207-224, 420-479, intensity at 127-130) exist only on Add; header date format (new.tsx:357 vs [id].tsx:321), headerTitle size (20 vs 16) and cardTitleRow gap also differ.

**Evidence:** app/entry/[id].tsx:134-153 FieldCard has no `tooltip` prop, while app/entry/new.tsx:189-229 renders an Info button + InfoModal per card — so the ⓘ explainers for pitch/duration/location/sound type/distress/triggers and intensity exist only on the add screen. new.tsx:357 formats the header date without `year` while [id].tsx:321 includes `year: 'numeric'`. headerTitle is 20pt in new.tsx:534 vs 16pt in [id].tsx:537; cardTitleRow has `gap: 6` in new.tsx:565 but none in [id].tsx:577. new.tsx:313-320 and [id].tsx:259-266 are identical date-combining code.

**What goes wrong:** Any fix to one form (e.g. the double-submit guard, timezone handling, a new field, a style tweak) must be re-applied by hand to the other; the missing tooltips on Edit show this has already happened. A user who wants to read what "Distress" means while editing has no ⓘ button.

**Suggested fix:** Extract a single EntryForm component (fields, header pickers, footer, styles) that takes initial values and an onSave callback, with new.tsx and [id].tsx as thin wrappers; move the shared date-combining into app/utils/datetime.ts.

### A4. [HIGH · architecture] Six copy-pasted single-choice settings screens, two copy-pasted manage-list screens and two copy-pasted entry forms (already diverging)
**Where:** `app/entry/[id].tsx:134`  ·  **Verifiers upholding:** 3/3

**What:** Six single-choice settings screens, two manage-list screens (triggers.tsx / sound-types.tsx differ only in query/label imports and i18n keys) and two entry forms are copy-pasted; the entry forms have already drifted — app/entry/new.tsx FieldCard (:199) and IntensityCard (:120-133) show InfoModal tooltips for all seven fields, while app/entry/[id].tsx FieldCard (:134-153) and the intensity card (:378-391) have no tooltip support, so the edit screen lacks every field explanation the add screen has.

**Evidence:** Measured: first-day-of-week.tsx 240 lines / 50 diff-lines vs appearance.tsx; default-chart-type.tsx 229/53; language.tsx 241/51; icon-style.tsx 234/92; app-lock.tsx 263/93; 116 lines are literally identical in all six (header/backBtn/row/badge/footer/saveBtn blocks, e.g. appearance.tsx:87-228 vs app-lock.tsx:112-256). triggers.tsx:1-353 vs sound-types.tsx:1-353 differ only in imported query names and i18n keys. Drift: new.tsx FieldCard (:200-229) takes `tooltip` and IntensityCard has an Info button (:120-133); [id].tsx FieldCard (:134-153) has no tooltip prop and the intensity card (:378-391) has no Info button, so the edit screen silently lost the explanations the add screen has.

**What goes wrong:** Any UX fix (e.g. the Android ghost-shadow fix from session 2026-09-12, a new accessibility label, a layout change) has to be applied in 2-6 files and, as the tooltip case shows, is not. Adding the next preference costs another 230-line file plus a context plus a Settings row.

**Suggested fix:** Extract `SingleChoiceScreen<T>({ titleKey, introKey, options, value, onSave, renderOption? })` and migrate the six screens; extract `ManageItemsScreen` parameterised by the four query functions; extract one `EntryForm` component with `mode: 'create' | 'edit'` and keep new.tsx/[id].tsx as thin wrappers that only decide save/delete/navigation.

### A5. [HIGH · bug] OTA updates can be published to a binary that lacks native modules added since the last version bump
**Where:** `app.json:76`  ·  **Verifiers upholding:** 3/3

**What:** `runtimeVersion.policy: "appVersion"` with OTA updates enabled, but native modules/config plugins (expo-navigation-bar, react-native-purchases, splash/notification plugin options) were added after the last `version` bump to 1.1.0; an `eas update` from HEAD would be applied to any pre-2026-09-24 1.1.0 binary, and app/_layout.tsx:5's unguarded `expo-navigation-bar` import throws at module evaluation when the native module is missing, making the app unusable until rollback/reinstall.

**Evidence:** app.json:75-81 `"runtimeVersion": { "policy": "appVersion" }`, `"updates": { "enabled": true, "url": ... }`; eas.json:11-22 channels development/preview/production. git: c183571 2026-09-14 'Bump version to 1.1.0 for production release' (app.json:6 still 1.1.0 at HEAD); bad1cb3 2026-09-24 added expo-navigation-bar; 5e73be9 2026-09-26 added react-native-purchases/-ui. app/_layout.tsx:5 top-level `import * as NavigationBar from 'expo-navigation-bar'`; node_modules/expo-navigation-bar/build/ExpoNavigationBar.android.js:2 `export default requireNativeModule('ExpoNavigationBar')` (throws when the native module is absent). app/utils/purchases.ts:19-22 guards `NativeModules.RNPurchases`, but nothing guards the navigation-bar import. CLAUDE.md/AGENTS.md/docs never mention eas update or runtimeVersion.

**What goes wrong:** A 1.1.0 binary built from c183571 (or any commit before 2026-09-24) is installed by users; `eas update --channel production` is run from HEAD. expo-updates (checkAutomatically default ON_LOAD) applies the bundle on next launch, the root layout module evaluation throws 'Cannot find native module ExpoNavigationBar', and the app is unusable until an emergency rollback is published or the user reinstalls.

**Suggested fix:** Switch to `"runtimeVersion": { "policy": "fingerprint" }` so OTA compatibility is computed from native code rather than a manually maintained string; otherwise add a hard rule (and a CLAUDE.md note) that every native dependency or config-plugin change bumps `expo.version` before any build or update.

### A6. [HIGH · bug] Trigger Impact row prints "N of N days" (entry counts) whenever the model has no estimate; PDF prints the real day counts
**Where:** `app/(tabs)/trends.tsx:468`  ·  **Verifiers upholding:** 3/3

**What:** Trigger Impact rows fall back to the entry-level tally for both count and total when the model has no estimate (always on 7D since MIN_OBSERVATIONS=8 > 7 days; also for any trigger present on every logged day), so the "{{count}} of {{total}} days" line prints "N of N days" with N = number of entries, contradicting the day-level "Days present" figures in the Reports PDF for the same period.

**Evidence:** app/(tabs)/trends.tsx:459-468 builds the row as `count: c ? c.present : tr.count, ... total: c?.total ?? tr.count` under a comment claiming "Day-level counts, matching the model"; `tr.count` comes from computeTopTriggers (lines 153-171), which counts entries (`for (const item of items) for (const name of p.entryTriggers.get(item.entryId)...) counts.set(name, +1)`), not days. Line 709 renders it unconditionally: `{t('stats.trigger.ofDays', { count, total })}` (en.json:112 "{{count}} of {{total}} days"). `c` is null for every trigger when app/stats/triggerModel.ts:158 returns `estimates: []` (fewer than MIN_OBSERVATIONS=8 logged days — always true on 7D) or when triggerModel.ts:152-155 drops a trigger present on every logged day. Rows still render in that case (card is gated only on `!!entries.length`, line 1741; empty state only when rows are empty). The PDF instead uses src/features/reports/reportData.ts:77-81 `days: [...byDay.values()].filter(day => day.triggers.has(name)).length, total: byDay.size` and reportHtml.ts:92 prints `${item.days} / ${item.total}` under "Days present".

**What goes wrong:** Fixture: 30D range, 6 logged days, two entries on the same day both tagged Caffeine (intensities 0 and 4), no other Caffeine entries. Stats > Trigger Impact row: "Caffeine — 2 of 2 days" (entries of entries). Reports > 30 days PDF, Frequently logged triggers: "Caffeine 1 / 6". Same for a trigger logged on all 10 days of a 90D window across 12 entries: Stats says "12 of 12 days" (more days than the range has logged), PDF says "10 / 10". On the 7D range every row is always "N of N days" because the model never runs there.

**Suggested fix:** Compute day-level counts in computeTopTriggers (or from model.input.days) independently of whether an estimate exists: `count` = number of distinct days in range whose trigger set includes the name, `total` = number of logged days in the range (model.input.days.length). Never fall back to `tr.count` for `total`; keep the entry-level tally only for the chip ordering/pct if still wanted, and label it as entries.

### A7. [HIGH · bug] App Lock replaces the whole navigator on background, destroying in-progress entries and all screen state
**Where:** `app/_layout.tsx:61`  ·  **Verifiers upholding:** 3/3

**What:** With App Lock enabled, every background event (AppLockContext.tsx:43-45) makes AppShell return <LockScreen /> instead of the root <Stack> (_layout.tsx:61), unmounting the navigator; React Navigation clears navigator state on unmount, so after unlocking the app restarts on the Home tab and any in-memory screen state is lost: a half-filled Log Entry form (entry/new.tsx:248-256, plain useState), an open edit screen, pushed Settings sub-screens, and the Stats range (trends.tsx:1455). Fix: render LockScreen as an overlay (absolute-fill or Modal) above the Stack so the navigator stays mounted.

**Evidence:** app/_layout.tsx:61 `if (completed && enabled && !unlocked) return <LockScreen />;` (the <Stack> at :64-79 is not rendered). app/contexts/AppLockContext.tsx:43-44 `if (nextState === 'background' && enabledRef.current) { setUnlocked(false); }`. node_modules/@react-navigation/core/src/useNavigationBuilder.tsx:784-786 `// We need to clean up state for this navigator on unmount ... setCurrentState(undefined);`. The entry form keeps all fields in component state (app/entry/new.tsx:248-256).

**What goes wrong:** App Lock on. User is on Log Entry with intensity, three triggers and a two-paragraph note filled in, switches to Messages to check what time the concert ended, returns 10 seconds later, unlocks with Face ID -> app shows the Home tab; the entry is lost with no warning. Same for an edit in progress or a deep Settings sub-screen.

**Suggested fix:** Render LockScreen as an absolute-fill overlay (or a full-screen Modal) on top of the Stack rather than instead of it, so the navigator and screen state stay mounted; optionally also persist the add-form draft.

### A8. [HIGH · bug] seedDevData() runs unguarded on every fresh install and marks onboarding complete
**Where:** `app/db/database.ts:104`  ·  **Verifiers upholding:** 3/3

**What:** seedDevData() is called unconditionally from initDatabase() with no __DEV__ guard; on any fresh install (including release builds) it inserts 15 fabricated entries, sets name='Alex' and onboarding_completed='true', and because OnboardingProvider mounts only after initDatabase() has run, the first launch skips onboarding, the medical disclaimer and the paywall entirely.

**Evidence:** database.ts:104 `seedDevData(); // TODO: remove before release` inside `initDatabase()`, with no `__DEV__` check anywhere in the function (242-293). Lines 290-292: `INSERT INTO settings ... ('dev_seeded','1')`, `INSERT OR IGNORE INTO settings ... ('name','Alex')`, `INSERT OR IGNORE INTO settings ... ('onboarding_completed','true')`. Lines 283-288 insert 15 entries with notes like 'Worst day this week, lots of caffeine'.

**What goes wrong:** A real user installs a production build. `dev_seeded` is absent, so the seed runs: the app opens straight to the tabs (no onboarding, no disclaimer acknowledgement, no paywall), Home says 'Good morning, Alex', Stats/Calendar/Reports show three weeks of fabricated symptom data, and the first export contains it.

**Suggested fix:** Wrap the call in `if (__DEV__) seedDevData();` today so the backlog TODO can't be missed, and remove the `onboarding_completed` write from the seed regardless so the dev build still exercises onboarding.

### A9. [HIGH · bug] Editing an entry re-anchors its timezone/local_date to the current device zone
**Where:** `app/db/queries.ts:263`  ·  **Verifiers upholding:** 3/3

**What:** `updateEntry` recomputes `timezone`/`local_date` from the current device zone whenever `createdAt` is present (not when it changed), and the edit screen always passes `createdAt` rebuilt from device-local Date getters, so any edit made in a different timezone re-anchors the entry to a different calendar day in Calendar, 7-day trend, achievements and reports.

**Evidence:** queries.ts:258-266: comment says 'Only recompute timezone/local_date when the timestamp actually changed' but the check is `if (data.createdAt) { newTimezone = getDeviceTimeZone(); newLocalDate = computeLocalDate(data.createdAt, newTimezone); }`. app/entry/[id].tsx:259-276 always builds `combined` from device-local `getFullYear/getMonth/getDate/getHours` and passes `createdAt: combined.toISOString()`. The edit header (app/entry/[id].tsx:321) formats `entryDate.toLocaleDateString(undefined, {...})` with no `timeZone`, whereas Home (app/(tabs)/index.tsx:49-54) formats with `timeZone: entry.timezone`. app/utils/datetime.ts:7-13 documents the invariant that travel 'never retroactively changes which calendar day ... a past entry appears to belong to'.

**What goes wrong:** Entry logged at 23:30 in New York (created_at 2026-10-05T03:30Z, local_date 2026-10-04). User is now in London and opens the entry to fix a typo: the edit header shows 'Oct 5, 04:30'. Tapping Save stores timezone=Europe/London, local_date=2026-10-05. The entry jumps from Oct 4 to Oct 5 on the Calendar, in day-of-week stats, in the trigger model's per-day grouping, and in reports — and Home now shows a different time than before the edit.

**Suggested fix:** On the edit screen, derive the date/time pickers in `entry.timezone` and only pass `createdAt` when the user actually changed date or time; additionally have `updateEntry` compare the incoming ISO with the stored `created_at` and skip recomputation when equal. Keep `timezone` on unchanged edits.

### A10. [HIGH · bug] Backup import accepts out-of-range intensity and invalid dates: crashes Stats and leaves partial imports
**Where:** `app/db/queries.ts:339`  ·  **Verifiers upholding:** 3/3

**What:** importEntries only checks that intensity is a number and created_at is truthy, with no range/date validation and no transaction. An integer intensity >= 7 is persisted and makes computeDistribution (app/(tabs)/trends.tsx:90-92) produce a sparse array whose hole becomes undefined in the [...dist] destructure at line 127, crashing the Stats tab on every visit; intensity 6 renders a NaN row. An unparseable created_at throws RangeError from computeLocalDate (app/utils/datetime.ts:69) mid-loop, leaving earlier rows committed so a retry duplicates them.

**Evidence:** app/my-data.tsx:198 `if (!Array.isArray(parsed?.entries)) throw new Error('Invalid backup file');` is the only file-level check. queries.ts:339 `if (!e.created_at || typeof e.intensity !== 'number') continue;` then :341-346 inserts. app/(tabs)/trends.tsx:90-91 `const counts = [0,0,0,0,0,0]; for (const item of items) counts[item.intensity]++;` -> `counts[7]++` makes a sparse array; :127 `[...dist].reverse().map(({ level, count, pct }) => {` destructures `undefined`; :128/:132 `SCALE_COLORS[level]` -> `withAlpha(undefined, 0.16)` -> `hex.slice` TypeError. queries.ts:342 `computeLocalDate(e.created_at, timezone)` -> datetime.ts:63 `formatToParts(new Date('garbage'))` throws RangeError. No `withTransactionSync` anywhere in app/db.

**What goes wrong:** (A) Import a hand-edited or third-party JSON with `"intensity": 7` -> import reports success, then every visit to Stats throws 'Cannot destructure property level of undefined' (red screen in dev, crash in release) until the row is found and deleted. (B) A row with `"created_at": "2026-13-45"` after 500 good rows -> RangeError, 'Import failed' dialog, but the 500 rows are already committed; retrying the import duplicates them.

**Suggested fix:** Validate each row (intensity integer 0-5, created_at parses to a finite Date, pitch/duration/location/impact in their allowed sets, note length) and skip/report invalid rows; wrap the whole import (and saveEntry/updateEntry) in `db.withTransactionSync`; clamp defensively in computeDistribution.

### A11. [HIGH · bug] Import accepts any JSON shape: no field/range validation, can brick the Home screen
**Where:** `app/db/queries.ts:339`  ·  **Verifiers upholding:** 3/3

**What:** importEntries only checks created_at is truthy and intensity is a number; created_at that is not a parseable ISO string (e.g. an epoch number, valid for `new Date()` at import time but stored as TEXT) is inserted and then throws RangeError in Intl.DateTimeFormat.format on every Home/Calendar/Stats render, and out-of-range intensity / non-enum pitch/impact/duration/location values are inserted verbatim and corrupt averages, distributions and the report chart.

**Evidence:** queries.ts:339 `if (!e.created_at || typeof e.intensity !== 'number') continue;` then :343-346 inserts `e.created_at, e.intensity, e.pitch ?? null, e.impact ?? null, e.duration ?? null, e.location ?? null, e.note ?? null` with no further checks. my-data.tsx:197-200 `const parsed = JSON.parse(text); if (!Array.isArray(parsed?.entries)) throw ...; importEntries(parsed.entries)` passes `any[]` straight through (the `ImportEntry` type is never enforced; `schema_version` written at my-data.tsx:138 is never read). Home renders every entry with `formatEntryTime(entry.created_at, entry.timezone)` (app/(tabs)/index.tsx:49 -> datetime.ts:91 `f.format(new Date(iso))`). Schema is TEXT for created_at (database.ts:29).

**What goes wrong:** A backup converted from another tool uses epoch milliseconds: `{"created_at": 1700000000000, "intensity": 3}`. `new Date(1700000000000)` is valid at import time so `computeLocalDate` succeeds and the row is inserted; SQLite TEXT affinity stores it as the string '1700000000000'. On the next Home render `new Date('1700000000000')` is an Invalid Date and `Intl.DateTimeFormat.format` throws RangeError: Invalid time value inside render -> the app crashes on its initial tab every launch; the only recovery is reinstalling, because My Data (Delete All) is behind the tab that crashes. Less dramatic but same root cause: `intensity: 9` is accepted and inflates the average above the '/ 5' scale in Stats and the PDF (reportHtml.ts:83 prints `data.average` next to '/ 5'; the distribution at reportData.ts:84 only counts levels 0-5 so percentages no longer sum to 100, and the trend y at reportHtml.ts:27 goes negative). `impact: 3` is stored (schema says INTEGER at database.ts:34 but code expects strings, see ExpandableEntryRow.tsx:155) and silently shows as '—'.

**Suggested fix:** Validate each entry before insert: `created_at` must be a string that parses to a finite Date (re-serialise with `.toISOString()`), `intensity` an integer in the app's range, `pitch`/`impact`/`duration`/`location` either null or one of the enum values in app/db/types.ts, `note` a string (cap length), `tinnitus_types`/`triggers` arrays of strings. Reject the whole file (not just the row) with the existing importFailed dialog when `schema_version` is missing or unknown. Also fix the `impact INTEGER` column type comment/schema so it matches the string values actually stored.

### A12. [HIGH · bug] Editing an entry silently re-anchors its timezone and calendar day to the device's current timezone
**Where:** `app/entry/[id].tsx:276`  ·  **Verifiers upholding:** 3/3

**What:** Edit screen always passes a rebuilt, device-local createdAt to updateEntry (no dirty check), so queries.ts:263's `if (data.createdAt)` guard always fires and rewrites timezone/local_date from the current device zone; a note-only edit after a timezone change moves the entry to another calendar day in Calendar, Home and Stats, and every save truncates created_at seconds.

**Evidence:** app/entry/[id].tsx:259-277 builds `combined` from entryDate/entryTime and passes `createdAt: combined.toISOString()` unconditionally; entryDate/entryTime come from `new Date(entry.created_at)` (lines 206-208), i.e. device-local, not the entry's stored `timezone`. app/db/queries.ts:256-266 says "Only recompute timezone/local_date when the timestamp actually changed" but the check is `if (data.createdAt)`, which is always truthy from this screen, so `newTimezone = getDeviceTimeZone()` and `newLocalDate = computeLocalDate(...)` always run. Calendar/stats bucket by `local_date` (queries.ts:226, sevenDayTrend.ts:35).

**What goes wrong:** Entry logged at 23:30 on 1 Mar in America/New_York (local_date 2026-03-01). User flies to London, opens that entry to fix a typo in the note and taps Save without touching date/time. The form showed 2 Mar 04:30; on save timezone becomes Europe/London and local_date becomes 2026-03-02. The entry disappears from 1 Mar and appears on 2 Mar in Calendar, Home and all stats. Even without travel, seconds are zeroed (line 265) so created_at changes on every save.

**Suggested fix:** In the edit screen, pass createdAt only when the user actually changed the date or time (compare against the loaded entry's created_at, or track a `dateTouched` flag), and build/display the form date-time in the entry's stored `timezone` rather than the device zone. Keep seconds from the original timestamp when untouched.

### A13. [HIGH · bug] Deleting an entry replaces the root stack's top route with a second `(tabs)` navigator, leaving the original one mounted underneath
**Where:** `app/entry/[id].tsx:294`  ·  **Verifiers upholding:** 3/3

**What:** `confirmDelete` uses `router.replace('/calendar')` / `router.replace('/')` from the `entry/[id]` root-stack screen; expo-router resolves this to a root-stack REPLACE whose payload is a new `(tabs)` route (no `singular`/`getId` on the `(tabs)` screen), so the tab navigator is duplicated (`[(tabs)#1, (tabs)#2]`) instead of returned to: all tab screens remount and lose state, hardware back lands on the stale copy instead of exiting, and each delete stacks another layer. The calendarNav.ts module-global and calendar.tsx render-phase initializers are workarounds for this remount. Fix with `router.dismissTo('/(tabs)/calendar')` / `router.dismissTo('/(tabs)')` (or `router.back()` + tab jump).

**Evidence:** app/entry/[id].tsx:292-297: `if (from === 'calendar') { if (entryLocalDateRef.current) setPendingCalendarDate(entryLocalDateRef.current); router.replace('/calendar'); } else { router.replace('/'); }`. The root stack (app/_layout.tsx:64-79) is `[(tabs), entry/[id]]` at this point. node_modules/expo-router/build/global-state/routing.js:334-370 `findDivergentState` only compares the *focused* root route (`navigationState.routes[navigationState.index]` = `entry/[id]`) against the action's root route `(tabs)`; they differ, so it breaks at depth 0 and `getNavigateAction` (routing.js:260-306) dispatches `{ type: 'REPLACE', target: <root stack key>, payload: { name: '(tabs)', params: { screen: 'calendar' } } }`. node_modules/@react-navigation/routers/src/StackRouter.tsx:315-345: REPLACE does `createRouteFromAction(...)` (a fresh route key) and maps it over `state.routes[state.index]` only — the existing `(tabs)` route at index 0 is untouched. The project already observed the symptom: app/utils/calendarNav.ts:1-9 explains the module-global exists because "a delete's router.replace('/calendar') can trigger a full remount of the Calendar screen", and app/(tabs)/calendar.tsx:81-90 consumes that global during render to survive the remount; a remount of a tab screen inside a *surviving* tab navigator does not happen with a JUMP_TO, so what was observed is exactly this second `(tabs)` instance.

**What goes wrong:** Calendar tab -> tap pencil on an entry -> Delete -> confirm. Root stack becomes `[(tabs)#1, (tabs)#2]`: the user sees a freshly mounted copy of the app (Calendar re-opened on the entry's month via the pending-date global; Home/Stats/More in #2 are fresh, so the Stats range, open trigger panels, chart toggle and scroll positions are reset). Press Android hardware back (or iOS edge-swipe, since the new `(tabs)` route has default `gestureEnabled`): instead of leaving the app, the user lands on `(tabs)#1`, the old copy that still has its old state, whose Calendar focus effect then re-runs on a `skipFocusResetRef` that was armed in #1 by `onEditPress` (calendar.tsx:364). Each further delete adds another `(tabs)` layer (N deletes = N back presses before the app exits), and every layer keeps all of its mounted tab screens, including a Stats screen holding up to 1000 entries plus rawTriggers/rawTypes arrays (trends.tsx:1484-1486), alive in memory. Same outcome via the Home path: `router.replace('/')` hits app/index.tsx, whose `<Redirect href="/(tabs)">` (node_modules/expo-router/build/link/Redirect.js:34-37) issues another root REPLACE that again creates a new `(tabs)` route.

**Suggested fix:** Return to the existing tab navigator instead of replacing into a new one: `router.dismissTo('/(tabs)/calendar')` / `router.dismissTo('/(tabs)')` (pops the root stack back to the already-mounted `(tabs)` route and jumps to the tab), or plain `router.back()` followed by the tab jump. Once the Calendar instance is guaranteed to survive, the module-global in app/utils/calendarNav.ts and the render-phase `consumePendingCalendarDate()` + lazy `getEntriesForMonth` initializers in app/(tabs)/calendar.tsx:81-107 can be replaced by an ordinary focus-time read (or a route param), removing the only render-time side effect in the app that depends on a render never being discarded. Verify after the change that a delete from Calendar lands on the entry's month without a flash and that hardware back from the tabs exits the app.

### A14. [HIGH · bug] Save button can be tapped twice, creating duplicate entries and popping two screens
**Where:** `app/entry/new.tsx:307`  ·  **Verifiers upholding:** 3/3

**What:** handleSave (new.tsx:307-336) has no re-entry guard and the Save PressableScale (503-507) is never disabled, so a double-tap within the 200 ms before router.back() inserts the same entry twice (identical created_at) and queues two router.back() calls; app/entry/[id].tsx:253-282/486-490 shares the pattern but only suffers the double back() since updateEntry is idempotent.

**Evidence:** app/entry/new.tsx:307-336: `handleSave` calls `saveEntry(...)`, `logEvent`, `syncAchievements`, `setSaved(true)` and `setTimeout(() => router.back(), 200)` with no `if (saved) return` and no busy ref; lines 503-507 render `<PressableScale onPress={handleSave} ...>` without a `disabled` prop. The same pattern exists in app/entry/[id].tsx:253-282 and 486-490.

**What goes wrong:** User double-taps "Save Entry" (taps ~100 ms apart). Both taps run saveEntry, producing two identical rows with the same created_at; two `router.back()` calls are queued, the second of which pops past the tabs or logs an unhandled GO_BACK. Stats averages, streaks and entry counts then double-count that check-in; on the edit screen the duplicate back() can leave the user on an unexpected screen.

**Suggested fix:** Add an early return when `saved` is already true (or a `savingRef`), pass `disabled={saved}` to the PressableScale, and only schedule one router.back().

### A15. [HIGH · bug] Backup drops timezone/local_date, so a restore re-dates entries in the importing device's timezone
**Where:** `app/my-data.tsx:141`  ·  **Verifiers upholding:** 3/3

**What:** Backup omits per-entry `timezone`/`local_date`/`source`; `importEntries` (app/db/queries.ts:341-345) recomputes `local_date` from `created_at` in the importing device's current timezone and leaves `source` NULL, so restoring on a device in a different zone shifts entries near local midnight to another calendar day in the calendar, home labels, streaks, achievements, 7-day trend and reports, and scheduled entries are later relabelled self_initiated by backfillLegacySource.

**Evidence:** app/my-data.tsx:141-151 exports only `created_at, intensity, duration, location, pitch, impact, note, tinnitus_types, triggers`. app/db/queries.ts:341-345: `const timezone = getDeviceTimeZone(); const localDate = computeLocalDate(e.created_at, timezone); ... INSERT INTO entries (... timezone, local_date) VALUES (...)`. app/utils/datetime.ts:7-12 documents that anchoring exists precisely so 'traveling across timezones never retroactively changes which calendar day ... a past entry appears to belong to'. The INSERT on queries.ts:344 also omits `source`, so restored rows are NULL until `backfillLegacySource` (database.ts:141-161) relabels them on the next cold start by `created_at >= anchor_era_start`, turning any 'scheduled' entry into 'self_initiated'.

**What goes wrong:** Entry logged 2026-03-01 22:00 in New York (stored created_at 2026-03-02T03:00:00Z, local_date 2026-03-01). User moves / is travelling and restores the backup in Berlin (UTC+1): local_date becomes 2026-03-02. Calendar shows the entry on the wrong day, streak/'logged days' milestones and the day-level Trigger Impact buckets (reportData.ts:52-57, evaluate.ts:131) all shift; every entry near local midnight in the old zone is affected.

**Suggested fix:** Export `timezone`, `local_date` and `source` per entry (bump `schema_version`) and, on import, use the stored timezone (falling back to the device zone only for older backups). Set `source` explicitly on import instead of leaving it NULL.

### A16. [HIGH · bug] Change tile shows a red up-arrow captioned "0%" when the previous period averaged 0 ("None")
**Where:** `app/stats/sevenDayTrend.ts:340`  ·  **Verifiers upholding:** 3/3

**What:** computePeriodChange (:325-330) returns a non-null difference when the prior period averaged 0, but computePeriodChangePercent (:340) returns null in that case; Home (app/(tabs)/index.tsx:228-240) and Stats (app/(tabs)/trends.tsx:1640-1657) render the arrow from the first and the caption from `periodChangePercent ?? 0`, so a prior week of "None" (0) followed by intensity 3 shows a red straight-up arrow captioned "0%".

**Evidence:** sevenDayTrend.ts:325-330 `if (prevAvg === null || currentAvg === null) return null; return currentAvg - prevAvg;` vs :340 `if (prevAvg === null || currentAvg === null || prevAvg === 0) return null;` with the stale comment at :335 "prevAvg is never 0 in practice (intensity is always >= 1)". But 0 is a selectable level: app/entry/new.tsx:62 `Array.from({ length: 6 }, ...)` and app/constants/theme.ts:2 `INTENSITY_LABELS = ['None', ...]`. Display: app/(tabs)/index.tsx:235-240 `bottom={periodChange !== null && (...(periodChangePercent ?? 0) > 0 ? '+' : ... ''}{Math.abs(periodChangePercent ?? 0).toFixed(0)}%` and identical code in app/(tabs)/trends.tsx:1652-1657.

**What goes wrong:** User logs intensity "None" (0) every day last week, then logs 3 today. periodChange = +3 so the tile draws a fully-rotated red ArrowUp (levelColor red for >= 1.0), while the caption underneath reads "0%". The user sees a strong-worsening arrow labelled as no change.

**Suggested fix:** Either return null from computePeriodChange when prevAvg === 0 (and show "—"), or stop using a percentage of the prior average on a 0–5 ordinal scale and show the difference in levels ("+3.0 levels"), which is exactly the reasoning the team already applied to Trigger Impact (trends.tsx:171-173).

### A17. [HIGH · design-decision] Restoring to a new device silently drops every custom trigger / sound-type link
**Where:** `app/db/queries.ts:350`  ·  **Verifiers upholding:** 3/3

**What:** importEntries drops any tinnitus-type/trigger name absent from the local catalog with no count, log or user feedback, and the export payload (app/my-data.tsx:149-150) carries no custom-item catalog, so restoring a backup on a fresh install silently strips every custom trigger/sound-type link while the dialog (app/my-data.tsx:203-207) reports success by entry count only.

**Evidence:** app/db/queries.ts:349-356: `const typeId = typeIdByName.get(name); if (typeId) db.runSync(...)` — a miss is a silent no-op. The export writes only names (app/my-data.tsx:149-150), not the custom catalog (`is_custom`/`is_active`). The success dialog reports only the entry count (app/my-data.tsx:203-207, `myData.importCompleteMessage`).

**What goes wrong:** User has custom triggers 'Late night snack' and 'Flight' logged on 40 entries. New phone, fresh install, Import: all 40 entries arrive with those triggers missing; Trigger Impact and the PDF never show them; 'Import Complete — 120 entries added' gives no hint. The user cannot recover the links even after re-creating the triggers by hand.

**Suggested fix:** Export the custom catalog (names with `is_custom`/`is_active`) alongside entries and re-create missing custom items on import (built-in names stay matched by English identity), or at minimum report 'M trigger links skipped' in the result dialog.

### A18. [HIGH · i18n] 24 of 27 locales are missing 135-174 of the 559 keys; `settings.on` is missing in all 27
**Where:** `app/app-lock.tsx:76`  ·  **Verifiers upholding:** 3/3

**What:** All 27 non-English locales are missing `settings.on` (but have `settings.off`), so Settings > App Lock and the Settings row show a mixed "Aus"/"On" pair; 20 locales additionally lack the whole `stats.trigger.*` (Trigger Impact card) and `anchor.*` (notification title/body) sections, and de/es/fr lack 5 keys — all fall back to English via `fallbackLng: 'en'` (app/i18n/index.ts:71). The Learn/Reports/Milestones fallback is documented as intentional; these are not.

**Evidence:** Script output (flattened keys, en=559): missing sections for ru = achievements 35, reports 54, learn 12, localSupport 24, stats.trigger 39, more 5 (`more.statisticsGuide`, `more.statisticsGuideSubtitle`, `more.supportSection`, `more.findLocalSupport`, `more.findLocalSupportSubtitle`), settings 3, anchor 2. `settings.on` (en.json:636) missing in 27/27 while `settings.off` present in 27/27; `stats.trigger.title` and `anchor.notificationTitle` missing in 20/27; `achievements.title`, `reports.title`, `localSupport.title`, `learn.minutes_other` missing in 24/27. de/es/fr each lack `settings.on`, `settings.appLockUnavailableTitle`, `settings.appLockUnavailableMessage`, `stats.intensityTrendRollingDesc`, `reports.pdf.notEnoughImpact`. Consumers: app/app-lock.tsx:76 `t(value ? 'settings.on' : 'settings.off')`, app/settings.tsx:164, app/(tabs)/trends.tsx:648-701 (Trigger Impact card), app/utils/notifications.ts:93-94 (`anchor.*`). Interpolation variables matched in every translated key (0 mismatches), so the gap is purely missing keys.

**What goes wrong:** German user opens Settings > App Lock: the two radio rows read "Aus" and "On". Russian user opens Stats: every heading in the Trigger Impact card, its info sheet and empty states are English while the rest of the tab is Russian; the More tab shows "Find local support" and "How your statistics work" rows between Russian rows; the random "Quick check-in" notification arrives in English for 20 of 28 languages.

**Suggested fix:** CLAUDE.md only acknowledges Learn/Reports/Milestones as English-fallback; the stats.trigger (20 locales), anchor (20), settings (27) and de/es/fr gaps are unplanned drift. Fix the 5 de/es/fr keys and `settings.on` everywhere now, generate the remaining sections the same way the rest were produced, and wire the key-parity one-liner into CI (fail when any locale's key set != en.json).

### A19. [HIGH · i18n] The six intensity level labels on the entry form are hard-coded English and never translated
**Where:** `app/entry/new.tsx:91`  ·  **Verifiers upholding:** 3/3

**What:** The intensity level labels under the six intensity icons on the add (app/entry/new.tsx:91) and edit (app/entry/[id].tsx:85) forms render the hard-coded English INTENSITY_LABELS array (app/constants/theme.ts:2) instead of a translated string, so they stay English in all non-English locales even though translations already exist as reports.pdf.levels and are used via t() in src/features/reports/reportHtml.ts:90.

**Evidence:** app/constants/theme.ts:2 `export const INTENSITY_LABELS = ['None', 'Faint', 'Mild', 'Moderate', 'Loud', 'Severe'] as const;` rendered at app/entry/new.tsx:91 `{INTENSITY_LABELS[i]}` and app/entry/[id].tsx:85. Translations exist only under the report namespace: app/i18n/locales/de.json:245 `"levels": ["Keine", "Sehr schwach", "Leicht", "Mittel", "Laut", "Stark"]` (reports.pdf.levels).

**What goes wrong:** App language set to Deutsch: every card title and hint on the entry form is German, but the row of labels under the intensity icons reads NONE / FAINT / MILD / MODERATE / LOUD / SEVERE.

**Suggested fix:** Add an `entryForm.intensityLevels` array (or reuse reports.pdf.levels) and render `t(...)[i]`; keep INTENSITY_LABELS only if something needs a locale-independent key.

### A20. [HIGH · ux] Icon-only controls have no accessibility labels; screen readers announce them as unnamed buttons (one accessibilityLabel in the whole app)
**Where:** `app/(tabs)/_layout.tsx:89`  ·  **Verifiers upholding:** 3/3

**What:** Icon-only Pressables across the app (FAB, back, edit pencil, delete, calendar month nav, info buttons, InfoModal close, reminder Switches) carry no accessibilityLabel; the only labelled control is CustomizeLink. AddTabButton also discards BottomTabBarButtonProps so the navigator's own accessibility props are lost.

**Evidence:** grep `accessibilityLabel` across app/ and src/ → only app/components/CustomizeLink.tsx:26. (tabs)/_layout.tsx:40 `function AddTabButton(_props: BottomTabBarButtonProps)` ignores the props and :89-98 renders `<PressableScale onPress={() => router.push('/entry/new')} ...><Plus .../>`. Others: app/components/ExpandableEntryRow.tsx:246-256 (pencil), app/entry/[id].tsx:310-312 (trash), app/(tabs)/calendar.tsx:249-258 (prev/next), app/entry/new.tsx:120,208 (info), app/settings.tsx:95-97 (back, same pattern on every screen), app/components/InfoModal.tsx:83-90 (role but no label), app/reminders.tsx:115-120 (Switch without label), ExpandableEntryRow.tsx:229 (expand toggle with no role/expanded state).

**What goes wrong:** VoiceOver/TalkBack user on Home: the primary action is announced as "button" with no name; the calendar's month navigation is two unnamed buttons; the delete control on the edit screen is indistinguishable from the back control.

**Suggested fix:** Add `accessibilityRole="button"` + `accessibilityLabel` (existing keys cover most: common.edit/delete, tabs.add, entryForm.customize) to every icon-only Pressable, forward `accessibilityState`/`accessibilityLabel` from BottomTabBarButtonProps in AddTabButton, and give Switches a label via the row text.

### A21. [HIGH · ux] Inactive tab icons/labels and several small text styles use tokens that fail WCAG contrast (1.5:1 and 2.6:1)
**Where:** `app/(tabs)/_layout.tsx:112`  ·  **Verifiers upholding:** 3/3

**What:** Inactive tab icons and 12pt labels use `colors.textFaint` (#CBD5E1 on white = 1.48:1; dark #48526B on #151C2E = 2.18:1), failing WCAG's 3:1 floor for icons and 4.5:1 for text; the same token colors the 9pt unselected intensity-scale captions (app/entry/new.tsx:86), and `textMuted` (#94A3B8, 2.3-2.6:1 on light surfaces) is used for 10-14pt informational text across Home, Stats, entry form and More. The stronger `tabInactive` token in theme.ts:69 is defined but unused.

**Evidence:** (tabs)/_layout.tsx:112 `tabBarInactiveTintColor: colors.textFaint` with 12pt labels at :177-181; theme.ts:100-101 `textMuted: '#94A3B8', textFaint: '#CBD5E1'` (:115-116 dark). app/entry/new.tsx:86 `color: selected ? SCALE_COLORS[i] : colors.textFaint` on a `fontSize: 9` label (:581). textMuted on small text: app/(tabs)/index.tsx:420-428 (10pt tile labels), :369-372 (12pt subtitle), app/(tabs)/trends.tsx:2018-2022 (inactive range labels), new.tsx:567,599 (hints), more.tsx:428-431 (row subtitles). Note the static theme already defines a stronger `tabInactive: '#94A3B8'` (theme.ts:69) that the tab bar does not use.

**What goes wrong:** In bright light or for a user with mild low vision, the "Stats / Calendar / More" tab labels (1.5:1) are effectively invisible against the white bar, and the unselected intensity labels (None…Severe) cannot be read before one is picked, so the scale meaning is hidden until after the choice.

**Suggested fix:** Use textSecondary (#64748B, 4.76:1) or at least textMuted for inactive tab tint; raise textMuted to ~#6B7A90 in light mode (≥4.5:1 on white) or stop using it below 13pt; render unselected scale labels in textSecondary.

### A22. [MEDIUM · architecture] CNG workflow with a stale local android/ folder: `run:android` silently builds without six config plugins
**Where:** `CLAUDE.md:9`  ·  **Verifiers upholding:** 3/3

**What:** CLAUDE.md (line 9 and six session notes) and package.json's `android` script present `npx expo run:android` as the native-rebuild step, but Expo CLI (`@expo/cli/build/src/run/ensureNativeProject.js:40-47`) only prebuilds when `android/` is missing. With the gitignored, stale Aug-11 `android/` present on this machine, that command silently builds without the RNFB, expo-notifications, expo-local-authentication, expo-navigation-bar, splash-colour and custom splash plugins added since. Document/script `expo prebuild --clean --platform android` (or `rm -rf android`) before `run:android` whenever app.json plugins or native deps change.

**Evidence:** .gitignore:40-41 `/ios`, `/android`. node_modules/expo/node_modules/@expo/cli/build/src/run/ensureNativeProject.js:40-47 `if (!fs.existsSync(path.join(projectRoot, platform))) { await prebuildAsync(...) } else {...}`. Local android/: every file dated Aug 11 19:12; android/app/build.gradle:1-3 applies only com.android.application / kotlin / com.facebook.react (no google-services or crashlytics plugin, which @react-native-firebase/app's plugin adds); android/app/google-services.json does not exist; res/values/styles.xml has no `android:windowBackground` (plugins/withSplashWindowBackground.js:10) and no `enforceNavigationBarContrast`; res/values/colors.xml:2 `splashscreen_background=#ffffff` vs app.json:38 `#4384F3` (dcb0341, 2026-09-19). No android/.gradle or android/app/build exists, so no Gradle build has run from this folder. CLAUDE.md sessions 2026-08-05, 08-15, 08-24, 09-05, 09-24, 09-26 each say the feature 'required a run:android rebuild'.

**What goes wrong:** A developer follows CLAUDE.md and runs `npx expo run:android` on this checkout: the build succeeds but has no Firebase (no default FirebaseApp -> analytics/crashlytics/remote-config no-op), default notification icon/colour, white splash, system nav bar still light in dark mode, no Face ID usage string, and the custom splash plugin never applied; behaviour then differs from EAS builds, which prebuild fresh.

**Suggested fix:** Document and script the real rule: `npx expo prebuild --clean` (or `rm -rf android ios`) before `run:android` whenever app.json/plugins/native deps change; e.g. add `"android:clean": "expo prebuild --clean --platform android && expo run:android"`. Alternatively stop ignoring android/ and commit it (then plugins must be applied via prebuild deliberately).

### A23. [MEDIUM · architecture] Stats screen is a 2,298-line god component whose memoisation is defeated by fresh i18n label arrays every render
**Where:** `app/(tabs)/trends.tsx:1497`  ·  **Verifiers upholding:** 3/3

**What:** StatsScreen rebuilds its five i18n label arrays on every render (i18next returnObjects returns a fresh copy; distressLabels is a literal), so the 13 useMemos keyed on them (day-of-week, per-period enum fields, smoothed enum trends) recompute on every local state change (trigger row toggle, trend view, day-of-week chip, range). The expensive date bucketing (itemBuckets) stays cached, so the cost is a few ms of wasted work per interaction and defeated memoisation for any future React.memo children, not visible lag; the fingerprint optimisation at :1482-1495 is unaffected. Fix: useMemo the labels on i18n.language; separately, the 2,298-line file (29 top-level functions/components, 500-line makeStyles) should be split into app/stats/ compute modules and per-card components.

**Evidence:** File is 2,298 lines (wc). trends.tsx:1497-1501 `const dowLabels = t('stats.dowLabels', { returnObjects: true }) as string[]; ... const distressLabels = [t(...), t(...), t(...)];`. node_modules/i18next/dist/cjs/i18next.js:630 `const copy = resTypeIsArray ? [] : {};` (new array per call). trends.tsx:1547 `useMemo(() => computeDayOfWeekBuckets(processed, range, dowLabels), [processed, range, dowLabels])` and :1549-1562 twelve more memos keyed on pitchLabels/durationLabels/locationLabels/distressLabels. Re-render triggers: setOpenTriggers (:1748), setTrendView (:1689), setDowCategory (:1760), setShownRange (:1466).

**What goes wrong:** With a 90-day diary the user taps a trigger row to expand it; every tap re-buckets the whole period for 4 enum fields twice (period + smoothed trend) and 7 weekday buckets. On a mid-range Android phone this is the visible lag the comments at 1432-1444 and 1476-1481 were written to avoid.

**Suggested fix:** Memoise label arrays on `i18n.language` (or compute them inside the memo from `t`), then split the file: app/stats/ gets computeDistribution/computeTopTriggers/computeEnumField*/smoothStackedTrend, app/components/stats/ gets TriggersCard, CorrelationPanel, DayOfWeekCard, StackedBarCard, StackedTrendChart, SoundTypesCard; trends.tsx keeps data loading + layout.

### A24. [MEDIUM · architecture] trends.tsx is a 2298-line screen that bundles pure statistics, generic chart components and a 500-line stylesheet; the model's day-aggregation is copied in three places
**Where:** `app/(tabs)/trends.tsx:1523`  ·  **Verifiers upholding:** 3/3

**What:** The 2298-line Stats screen inlines pure statistics (computeDistribution l.87 ... computeSoundTypes l.1139), generic chart UI (CollapsiblePanel l.200, PercentAxis l.1207, StackedTrendChart l.1261) and a 500-line makeStyles (l.1799) that every card is typed against via `ss: Styles` (l.42); the per-day model-input aggregation at l.1523-1539 is duplicated in src/features/reports/reportData.ts l.51-72 and src/features/achievements/evaluate.ts l.111-120 and is untestable from tests/stats. app/components/charts/IntensityTrendChart.tsx l.9-15 falsely claims Stats keeps its own inline copy while trends.tsx l.33 imports from it.

**Evidence:** Pure functions living in the screen: computeDistribution (l.87), computeTopTriggers (l.153), computeDayOfWeekBuckets (l.778), computeEnumField (l.910), computeEnumFieldBuckets (l.949), smoothStackedTrend (l.1001), computeSoundTypes (l.1139), and the model input aggregation inside a useMemo (l.1523-1539). Generic UI: CollapsiblePanel (l.200-264), PercentAxis (l.1207), StackedTrendChart (l.1261-1404). Every card takes `ss: Styles` where `type Styles = ReturnType<typeof makeStyles>` (l.42) and makeStyles spans l.1799-2298, so nothing can move without the stylesheet. The same byDay sum/n/Set aggregation is re-implemented in src/features/reports/reportData.ts l.51-72 and src/features/achievements/evaluate.ts l.111-120. app/components/charts/IntensityTrendChart.tsx l.9-15 still claims "Stats keeps its own copy of these components inline" while trends.tsx l.32-34 imports IntensityBarChart/IntensityLineChart from it.

**What goes wrong:** A change to how a day's intensity or trigger set is aggregated (e.g. deciding that a day's intensity should be the max, or that 'legacy' entries are excluded) has to be made in three files; the Stats copy sits in a file that imports react-native and expo-router, so tests/stats cannot exercise it and Stats, Reports and Milestones can silently diverge on what the model is fed.

**Suggested fix:** Move the compute functions and the day-aggregation into app/stats/ (e.g. app/stats/aggregate.ts exporting buildModelInput(entries, triggersByEntry)) and have trends.tsx, reportData.ts and evaluate.ts call it; lift CollapsiblePanel, PercentAxis and StackedTrendChart into app/components/; split the cards into app/components/stats/*Card.tsx each owning its own small StyleSheet. Fix the stale comment in IntensityTrendChart.tsx.

### A25. [MEDIUM · architecture] Anchor check-in / entry provenance machinery is dormant and half-wired
**Where:** `app/db/queries.ts:23`  ·  **Verifiers upholding:** 3/3

**What:** Anchor check-in machinery (prompts table, entries.source, backfillLegacySource, scheduleAnchorIfNeeded/markPrompt*/getAnchorAdherence) is dead code: nothing calls startAnchorEra or reads source. If enabled as-is, defaultEntrySource() (queries.ts:23-26) ignores createdAt and markPromptAnswered is never called, so every entry — including backdated calendar entries — saved during a 75-minute prompt window would be labelled 'scheduled'.

**Evidence:** `startAnchorEra`, `scheduleAnchorIfNeeded`, `markPromptOpened`, `markPromptAnswered`, `getAnchorAdherence` have zero callers outside their own files (grep across app/ and src/); no `addNotificationResponseReceivedListener`/`useLastNotificationResponse` anywhere. `entries.source` is read by nothing outside app/db (grep). database.ts:141-161 `backfillLegacySource()` still runs every launch; database.ts:59-82 documents the design at length. Latent bug: queries.ts:23-26 `defaultEntrySource()` returns 'scheduled' whenever `openPrompt()` is non-null, and `saveEntry` (433) ignores `data.createdAt` when deciding, so a backdated calendar entry saved inside the 75-minute window (notifications.ts:36) would be labelled a random-time sample; since nothing ever calls `markPromptAnswered`, every entry in that window would be.

**What goes wrong:** Today: every entry is 'legacy', prompts table stays empty, dead schema and code ship in the app. If a future change calls `startAnchorEra()`: an anchor fires at 14:00; at 14:30 the user logs an entry for five days ago from the Calendar and it is stored as `source='scheduled'`; a second entry at 14:50 is also 'scheduled' because the prompt is never marked answered — the missingness model the comments describe would be fed wrong labels.

**Suggested fix:** Either finish the feature (notification response listener → `markPromptOpened`/`markPromptAnswered`; only label 'scheduled' when `createdAt` falls inside the open prompt's window) or remove the `prompts` table, `source` column and backfill until it is actually scheduled for implementation.

### A26. [MEDIUM · architecture] The anchor check-in subsystem is dead code: never started, never scheduled, never handled on tap
**Where:** `app/utils/notifications.ts:73`  ·  **Verifiers upholding:** 3/3

**What:** Anchor check-in subsystem is dead code: scheduleAnchorIfNeeded, startAnchorEra, markPromptOpened, markPromptAnswered, getAnchorAdherence and the `anchor.*` i18n keys have no callers, no notification-response listener exists, and nothing reads entries.source — so the prompts table, backfillLegacySource() and the source column describe a sampling frame that never runs, and every entry is permanently labelled 'legacy'.

**Evidence:** grep over app/ and src/ for `scheduleAnchorIfNeeded|rearmPendingAnchor` finds only app/utils/notifications.ts; `startAnchorEra|markPromptOpened|markPromptAnswered|getAnchorAdherence|anchor_window_start|anchor_window_end` have no callers outside app/db/queries.ts (definitions at :14, :61, :67, :89) and app/db/database.ts:148 (a read). No `addNotificationResponseReceivedListener`/`getLastNotificationResponse` anywhere, so the `data: { kind: 'anchor' }` payload (notifications.ts:95, :152) could never be routed. Consequences in code: `getAnchorEraStart()` (queries.ts:9-11) is always null → `defaultEntrySource()` (queries.ts:23-26) returns 'legacy' for every entry ever inserted (queries.ts:433 `data.source ?? defaultEntrySource()`); `rearmPendingAnchor` (notifications.ts:142-143) always returns early; the 14-line rationale comment at app/db/database.ts:59-72 and the `prompts` table (:73-82) plus `backfillLegacySource()` (:140-162, runs every launch) support a feature that is not wired. No stats code reads `source` (grep for `'scheduled'|'self_initiated'|'legacy'` in app/stats and src returns nothing).

**What goes wrong:** A user never receives an anchor prompt; if the feature is later switched on by calling startAnchorEra(), every entry logged until that moment is already permanently labelled 'legacy' (correct by the comment's definition), but nothing today validates the window settings, the response listener, or the rearm path — the first time they run is in production. Meanwhile the schema and comments make reviewers believe anchors are live.

**Suggested fix:** Decide explicitly: either wire it end-to-end (call `startAnchorEra()` when onboarding completes, call `scheduleAnchorIfNeeded(t)` after the reminder sync on launch/foreground, register `Notifications.addNotificationResponseReceivedListener` in the root layout to `markPromptOpened(id)` and route to entry/new, and have the stats model consume `source`), or remove the prompts table, the anchor functions and `backfillLegacySource()` until the feature is scheduled, keeping the `source` column nullable. Leaving it half-shipped is misleading and adds a per-launch DB scan for nothing.

### A27. [MEDIUM · architecture] app/ vs src/features boundary is bidirectional, and non-route modules under app/ are registered as navigable routes
**Where:** `src/features/achievements/sync.ts:1`  ·  **Verifiers upholding:** 3/3

**What:** src/features imports app/db and app/stats (sync.ts:1, evaluate.ts:1-2, reportData.ts:1-2) while 8 app/ screens import src/features, so there is no enforceable layer direction; and because expo-router's require.context matches every .ts/.tsx under app/, the two non-screen default exports (app/db/database.ts:295 SQLite handle, app/i18n/index.ts:75 i18n instance) are registered as navigable routes `/db/database` and `/i18n` reachable via the `tinnitus-app://` scheme (rendering a non-component -> React "Element type is invalid" crash), and every other non-screen file under app/db, app/utils, app/stats, app/i18n emits the dev "missing default export" route warning. app/achievements.tsx:44-52 additionally duplicates syncAchievements inline (functionally equivalent today, drift risk).

**Evidence:** src/features/achievements/sync.ts:1 `import { ... } from '../../../app/db/queries';`, evaluate.ts:1-2 and reports/reportData.ts:1-2 import `../../../app/db/types` and `../../../app/stats/triggerModel`; app/entry/new.tsx:33, app/reports.tsx:13-16 import `../src/features/...`. node_modules/expo-router/_ctx.android.js matches every `.[tj]sx?` under the app root. app/db/database.ts:295 `export default db;` and app/i18n/index.ts:75 `export default i18n;` -> routes `/db/database` and `/i18n`. app.json:5 `"scheme": "tinnitus-app"` makes them deep-linkable. app/achievements.tsx:44-52 also re-implements syncAchievements (sync.ts:11-16) inline instead of calling it.

**What goes wrong:** Opening `tinnitus-app://db/database` (or `/i18n`) asks React to render a SQLiteDatabase object as a component -> 'Element type is invalid' crash; in dev every app/db, app/utils, app/stats file without a default export produces the 'missing the required default export' route warning. Refactors cannot move the DB out of app/ without touching src/features, and an achievement unlocked on the Milestones screen bypasses the one shared sync path.

**Suggested fix:** Move db/, stats/, utils/, contexts/, hooks/, i18n/, constants/ out of app/ into src/ (expo-router only needs screens and components used by screens in app/), make src/features depend only on src/data + src/domain, and have achievements.tsx call syncAchievements().

### A28. [MEDIUM · bug] userInterfaceStyle: 'light' locks iOS to light mode, so the 'Automatic' theme can never be dark on iOS
**Where:** `app.json:9`  ·  **Verifiers upholding:** 3/3

**What:** `"userInterfaceStyle": "light"` in app.json makes prebuild write UIUserInterfaceStyle=Light into the iOS Info.plist, so useColorScheme() always returns 'light' on iOS; ThemeContext.tsx:33 then resolves the default 'automatic' theme to light even when the iPhone is in Dark Mode, and appearance.tsx:20-23 labels it "Automatic (Light)". Only an explicit 'Dark' selection yields dark mode on iOS. Android is unaffected because expo-system-ui is not installed. Fix: set "userInterfaceStyle": "automatic" and re-run prebuild.

**Evidence:** app.json:9 `"userInterfaceStyle": "light"`; generated ios/TinnitusTracker/Info.plist:88-89 `<key>UIUserInterfaceStyle</key><string>Light</string>`; app/contexts/ThemeContext.tsx:26,32-35 `const systemScheme = useColorScheme(); ... setting === 'automatic' ? (systemScheme === 'dark' ? 'dark' : 'light') : setting`; app/appearance.tsx:17,29-32 shows 'Automatic (Light)'. `ls node_modules/expo-system-ui` -> not installed; android strings.xml has no expo_system_ui_user_interface_style.

**What goes wrong:** iPhone in system Dark Mode, app Appearance left on the default 'Automatic' -> app renders light, the Appearance screen says 'Automatic (Light)', and only an explicit 'Dark' choice gives dark mode.

**Suggested fix:** Set `"userInterfaceStyle": "automatic"` in app.json (and add expo-system-ui if Android should honour a forced style in future); re-run prebuild.

### A29. [MEDIUM · bug] iOS is forced to light mode, so Appearance → Automatic can never resolve to dark on iPhone/iPad
**Where:** `app.json:9`  ·  **Verifiers upholding:** 3/3

**What:** `"userInterfaceStyle": "light"` in app.json (prebuilt into ios/TinnitusTracker/Info.plist:88-89 as UIUserInterfaceStyle=Light) pins iOS to light traits, so `useColorScheme()` in app/contexts/ThemeContext.tsx:26,33 and app/appearance.tsx:17,30 always returns 'light'; the default Appearance=Automatic can never resolve to dark on iOS and the subtitle always says "Matches your device (Light)". Android is unaffected only because expo-system-ui is not installed, so the plugin merely warns. Fix: set `"userInterfaceStyle": "automatic"` and rebuild.

**Evidence:** app.json:9 `"userInterfaceStyle": "light"`; generated ios/TinnitusTracker/Info.plist:88-89 `<key>UIUserInterfaceStyle</key><string>Light</string>` (node_modules/@expo/prebuild-config .../withIosUserInterfaceStyle.js:22 defaults to 'light' when unset). app/contexts/ThemeContext.tsx:26 `const systemScheme = useColorScheme();` and :33 `setting === 'automatic' ? (systemScheme === 'dark' ? 'dark' : 'light') : setting`. app/appearance.tsx:17,29-31 shows the subtitle "Matches your device ({{mode}})" from the same hook. Android is unaffected only because expo-system-ui is not installed (node_modules/expo-system-ui absent; the Android plugin just warns), so the two platforms silently behave differently.

**What goes wrong:** iPhone in system Dark Mode, app Appearance = Automatic (the default): the app renders light and the Appearance screen says "Matches your device (Light)". Only the manual Dark override works.

**Suggested fix:** Set `"userInterfaceStyle": "automatic"` in app.json and rebuild. Keep the onboarding screens' explicit light palette (they already force `<StatusBar style="dark" />`).

### A30. [MEDIUM · bug] `userInterfaceStyle: "light"` forces iOS to light appearance, so the app's own 'Automatic' theme can never resolve to dark on iOS
**Where:** `app.json:9`  ·  **Verifiers upholding:** 3/3

**What:** `userInterfaceStyle: "light"` in app.json becomes `UIUserInterfaceStyle=Light` in the iOS Info.plist, so `useColorScheme()` (ThemeContext.tsx:26/33, appearance.tsx:17/30) always returns 'light' on iOS; the default 'Automatic' theme never follows system Dark Mode there and the Appearance screen misreports the system scheme. Fix: set it to "automatic" and re-prebuild iOS.

**Evidence:** app.json:9 `"userInterfaceStyle": "light"`. ThemeContext.tsx:26 `const systemScheme = useColorScheme();` and :32-34 `setting === 'automatic' ? (systemScheme === 'dark' ? 'dark' : 'light') : setting`. appearance.tsx:12 offers `['automatic','light','dark']` and :30 labels Automatic with the current `systemScheme`. node_modules/@expo/prebuild-config/build/plugins/unversioned/expo-system-ui/withIosUserInterfaceStyle.js `getUserInterfaceStyle(...) ?? 'light'` -> `UIUserInterfaceStyle: 'Light'`; the local ios/ prebuild output confirms `<key>UIUserInterfaceStyle</key><string>Light</string>` (Info.plist:88-89). Android is unaffected only because expo-system-ui is not installed (withAndroidUserInterfaceStyle.js just emits a warning).

**What goes wrong:** iOS user with system Dark Mode leaves the default 'Automatic' theme: the app stays light, and the Appearance screen's subtitle says the system is currently Light. Choosing 'Dark' explicitly works, which makes 'Automatic' look broken. The Android build happens to behave correctly, so the two platforms diverge.

**Suggested fix:** Set `"userInterfaceStyle": "automatic"` in app.json (the key defaults to 'light' if removed, so it must be set explicitly), then re-run prebuild for iOS. If Android should also honour it via expo-system-ui in future, the same value applies there.

### A31. [MEDIUM · bug] Change tile shows "0%" under a maximum-worse arrow when the previous week averaged intensity 0
**Where:** `app/(tabs)/index.tsx:237`  ·  **Verifiers upholding:** 3/3

**What:** Change tile shows a maximum-worse red arrow captioned "0%" when the previous window averaged intensity 0 ("None"): computePeriodChangePercent returns null for prevAvg === 0 while computePeriodChange still returns the positive absolute change, and both app/(tabs)/index.tsx:237-238 and app/(tabs)/trends.tsx:1654-1655 coerce the null to 0% instead of showing a non-numeric caption. The sevenDayTrend.ts:335-336 comment claiming intensity is always >= 1 is stale since the 0-5 scale was introduced.

**Evidence:** theme.ts:2 `INTENSITY_LABELS = ['None', 'Faint', 'Mild', 'Moderate', 'Loud', 'Severe']` and entry/new.tsx:62-67 `Array.from({ length: 6 }, (_, i) => ... onChange(selected ? null : i)` allow intensity 0. sevenDayTrend.ts:340 `if (prevAvg === null || currentAvg === null || prevAvg === 0) return null;` (comment at 335-336 assumes "prevAvg is never 0 in practice (intensity is always >= 1)", which is no longer true). sevenDayTrend.ts:329 `return currentAvg - prevAvg;` has no such guard. index.tsx:228 renders the arrow when `periodChange !== null`; lines 237-238 render `{(periodChangePercent ?? 0) > 0 ? '+' : ... }{Math.abs(periodChangePercent ?? 0).toFixed(0)}%`. CLAUDE.md still documents the scale as 1-5.

**What goes wrong:** Days -13..-7 all logged as "None" (0); this week averages 3. `periodChange` = 3 -> `changeArrowAngle(3, 2.5)` = 0deg (straight up, red via `levelColor`). `periodChangePercent` = null -> caption prints "0%". The tile reads "CHANGE: [red up arrow] 0%" — a contradictory health statistic.

**Suggested fix:** When `periodChangePercent` is null but `periodChange` is not, render a non-numeric caption (e.g. "—" or a `stats.changeFromZero` string) instead of coercing to 0. Alternatively express the caption as the absolute level change (`+3.0`) which is always defined on this scale. Update the 1-5 wording in CLAUDE.md and the comment at sevenDayTrend.ts:335.

### A32. [MEDIUM · bug] Stats 'All' range is silently capped at the newest 1000 entries
**Where:** `app/(tabs)/trends.tsx:1484`  ·  **Verifiers upholding:** 3/3

**What:** Stats loads only `getRecentEntries(1000)` (queries.ts:209-214, `ORDER BY created_at DESC LIMIT ?`), and `filterItems`/`rangeDayCount` in app/stats/sevenDayTrend.ts (58-59, 295-301) treat that truncated list as "All", so past 1000 entries every 'All' figure and the "of N days" span exclude the oldest data, while app/reports.tsx:31 uses the unlimited `getAllEntriesWithRelations()` and reportData.ts:26/87 applies no cutoff for 'ALL' — the two screens disagree.

**Evidence:** trends.tsx:1484 `const nextEntries = getRecentEntries(1000);`. app/stats/sevenDayTrend.ts:58-59 `if (range === 'All') return p.tsList;` and 295-300 `rangeDayCount` uses `p.oldestTs` of that truncated list. app/reports.tsx:31 uses `getAllEntriesWithRelations()` (no limit), so Stats 'All' and the PDF report's 'ALL' disagree.

**What goes wrong:** A user logging ~3 entries/day passes 1000 rows after about 11 months. Stats > All then shows an average, intensity distribution and trigger effects computed over roughly the last 11 months only, and the Entries tile's 'of N days' understates the diary span, while the doctor report for the same range includes everything.

**Suggested fix:** For the 'All' range load all rows (SQLite returns 10k rows in a few ms) or, if the cap is intentional for rendering cost, label the range 'Last 1000 entries' and use the same cap in reports.

### A33. [MEDIUM · bug] 'All' range is silently capped at the 1000 most recent entries; the header date range, 'of N days' tile, monthly buckets and the model all treat that subset as the whole diary
**Where:** `app/(tabs)/trends.tsx:1484`  ·  **Verifiers upholding:** 3/3

**What:** Stats loads only the 1000 most recent entries (getRecentEntries(1000), ORDER BY created_at DESC LIMIT), but processEntries derives oldestTs/oldestDay from that capped set, so for diaries over 1000 entries the 'All' header start date, the Entries tile's 'of N days' denominator, the monthly chart's first bucket and the trigger model/distribution all silently exclude the oldest entries while being presented as the complete history; the join-table queries remain unbounded, fetching rows that can never be matched.

**Evidence:** trends.tsx l.1484 `getRecentEntries(1000)`; app/db/queries.ts l.209-213 `ORDER BY created_at DESC LIMIT ?`. formatRangeDates for 'All' uses `p.oldestDay` (trends.tsx l.54-57); rangeDayCount uses `p.oldestTs` (app/stats/sevenDayTrend.ts l.295-300); monthlyItemBuckets starts at `p.oldestDay` (l.174-181); the model input is `filterItems(processed, 'All')` = all 1000 (l.1524). Meanwhile getAllEntryTriggers()/getAllEntryTinnitusTypes() (l.1485-1486) are unbounded, so join rows for the dropped entries are fetched and fingerprinted but never used.

**What goes wrong:** Two years of diary at ~2 entries/day (1460 rows): the 'All' header shows a start date roughly 8 months after the real first entry, the Entries tile reads '1000 of 580 days', the monthly chart has no bars for the first 8 months, and the trigger model and distribution exclude the oldest 460 entries, all presented as the complete history.

**Suggested fix:** Either load all entries for Stats (SQLite handles a few thousand rows synchronously) or cap by date instead of count and show a 'showing the last N entries' note when the cap is hit; fetch join rows for the loaded entry ids only.

### A34. [MEDIUM · bug] Stats 'All' range silently truncates at the 1,000 most recent entries and disagrees with Reports
**Where:** `app/(tabs)/trends.tsx:1484`  ·  **Verifiers upholding:** 3/3

**What:** Stats loads only the 1,000 most recent entries (getRecentEntries(1000), ORDER BY created_at DESC LIMIT) and uses that set for the "All" range too, so users with >1,000 entries get a truncated start date, day count, entry count and distributions on Stats, while Reports (getAllEntriesWithRelations, uncapped) shows the full history; CLAUDE.md:34 still documents the cap as 200.

**Evidence:** trends.tsx:1484 `const nextEntries = getRecentEntries(1000);`; queries.ts:209-213 `ORDER BY created_at DESC LIMIT ?`; sevenDayTrend.ts:31-38 derives `oldestDay` from whatever was loaded, feeding formatRangeDates (trends.tsx:54-57) and rangeDayCount (sevenDayTrend.ts:295-300); app/reports.tsx:31 `setEntries(getAllEntriesWithRelations())` has no cap. CLAUDE.md 'Stats are computed on the fly from getRecentEntries(200)'.

**What goes wrong:** A user logging twice a day for 18 months (1,100 entries) opens Stats -> 'All' shows a start date ~2 months after they actually began, the 'Entries' tile and distribution exclude ~100 entries, and the Reports PDF for 'ALL' shows a different entry count and first date than the Stats tab.

**Suggested fix:** Query by range (WHERE local_date >= ?) for 7D/30D/90D and load everything for 'All' (the model is sub-millisecond per the author's own profiling), or raise/remove the cap and update CLAUDE.md.

### A35. [MEDIUM · bug] Stats windows go stale across midnight: the fingerprint only tracks diary content, so returning to the tab on a new day shows yesterday's 7D/30D/90D window
**Where:** `app/(tabs)/trends.tsx:1488`  ·  **Verifiers upholding:** 3/3

**What:** Stats focus effect only re-renders when the diary-content fingerprint changes, but every range window (filterItems/dailyItemBuckets/formatRangeDates) is derived from new Date() inside memos keyed on [processed, range]; returning to the still-mounted tab after midnight without a diary change shows yesterday's window until the user switches range or edits an entry.

**Evidence:** fingerprintStatsInput (l.69-83) folds only entry/trigger/type fields. useFocusEffect (l.1483-1495): `if (fp !== lastFingerprint.current) { ... setEntries(...) }` otherwise only `setHasLoaded(true)` (a no-op after first focus). itemBuckets (l.1507), stats (l.1513), periodChange (l.1514), rangeDates (l.1568) etc. depend on [processed, range] only, yet app/stats/sevenDayTrend.ts filterItems l.61-63 (`const cutoff = new Date()`), dailyItemBuckets l.129-131 and formatRangeDates trends.tsx l.50-62 all read the current date. By contrast Home sets unconditionally (app/(tabs)/index.tsx l.92 `setEntries(getRecentEntries(200))`).

**What goes wrong:** User opens Stats at 23:55 (7D header reads "Sep 28 – Oct 4"), backgrounds the app, returns to the Stats tab at 00:10 without logging anything. The fingerprint is identical, no state changes, no memo re-runs: the header still says Oct 4, the 7D chart's last bar is yesterday, the 'Change' tile compares the old windows. It stays wrong until an entry is added or edited.

**Suggested fix:** Include the current local day key in the fingerprint (e.g. `${formatDateKey(new Date())}:${h}`) or keep a `today` state updated in the focus effect and add it to the memo dependency arrays of every window-dependent computation.

### A36. [MEDIUM · bug] Startup DB init/reminders load has no catch: a migration failure crash-loops with no breadcrumb, no fallback and the splash never hides
**Where:** `app/_layout.tsx:96`  ·  **Verifiers upholding:** 3/3

**What:** Root startup block (app/_layout.tsx:96-106) runs initDatabase() and getReminders() in try/finally with no catch and no ErrorBoundary exported anywhere, so any DB/migration exception becomes an uncaught fatal on every launch (crash loop) with no recordError breadcrumb, no fallback UI, and the splash never hidden; the non-critical reminders read shares the same fate-deciding block.

**Evidence:** app/_layout.tsx:96-106 `try { initDatabase(); const reminders = getReminders(); ... } finally { setAppReady(true); }` — contrast with :88 and :90-94 where initRemoteConfig/initPurchases are caught and sent to recordError. No file under app/ exports `ErrorBoundary`, and expo-router only wraps a route in its `Try` boundary when the route exports one (node_modules/expo-router/build/useScreens.js:139-145 `if (ErrorBoundary) { ... <Try catch={ErrorBoundary}> }`). `SplashScreen.hideAsync()` is only called from `SafeAreaProvider onLayout` (:114), which never renders on this path. initDatabase runs schema-altering migrations on every launch (app/db/database.ts:91-104: ensureColumn ×5, backfills, splitPulsatileThrummingType, seeds).

**What goes wrong:** An existing install hits a failing ALTER TABLE/backfill (locked or corrupt SQLite file, a future migration bug) → initDatabase throws → effect throws → React tears down the root → release build: native 'Unhandled JS Exception' crash on every launch; dev: red box. Crashlytics only gets the raw fatal (no 'initDatabase failed' breadcrumb) and the user has no way to export or reset data short of clearing app storage. Also, a failure in the non-critical `getReminders()` (reminders table) takes the whole app down.

**Suggested fix:** Catch, `recordError(err, 'initDatabase failed')`, and render a minimal fallback screen (export/reset data) instead of the Stack; move the reminders sync into its own try so it cannot block launch; export an `ErrorBoundary` from app/_layout.tsx so later render/effect errors show a recoverable screen rather than a crash.

### A37. [MEDIUM · bug] Reminder notifications are rescheduled at launch with i18n still on 'en', and never re-synced after a language change
**Where:** `app/_layout.tsx:101`  ·  **Verifiers upholding:** 3/3

**What:** Cold-start `syncReminderNotifications(reminders, i18n.t.bind(i18n))` races the `LanguageProvider` effect that applies the saved language (i18n starts on 'en'), so reminder/anchor notification text may be scheduled in English; and `setLanguage` never re-syncs, so a language change leaves already-scheduled daily reminders in the old language until a reminder is next edited.

**Evidence:** app/i18n/index.ts:70 `lng: 'en'`. app/_layout.tsx:96-106: `initDatabase(); ... hasNotificationPermission().then(granted => { if (granted) syncReminderNotifications(reminders, i18n.t.bind(i18n)); }); } finally { setAppReady(true); }` — `LanguageProvider` only mounts after `appReady` (line 120) and applies the language in a passive effect: app/contexts/LanguageContext.tsx:86-91 `useEffect(() => { i18n.changeLanguage(resolvedLanguage); ... }, [resolvedLanguage])`. `syncReminderNotifications` (app/utils/notifications.ts:116-133) does `cancelAllScheduledNotificationsAsync()` then reschedules with `t('remindersScreen.notificationTitle')` / `t('remindersScreen.defaultBody')`. Only other caller: app/reminders.tsx:53; `setLanguage` (LanguageContext.tsx:93-96) does not call it.

**What goes wrong:** German user with the default reminder enabled cold-starts the app: the native permission promise resolves (one bridge round-trip) before the full provider tree commits and its passive effect runs, so the daily notification is re-registered as "Tinnitus Tracker / Time to log how your tinnitus is doing today." and fires in English that evening. Conversely, a user who switches from English to German in Settings keeps English notification text until they next toggle a reminder.

**Suggested fix:** Apply the saved language synchronously before scheduling (e.g. resolve `getSetting('language')` and call `i18n.changeLanguage(...)` right after `initDatabase()` in the startup effect, or in LanguageProvider's `useState` initializer — i18next's `loadResources` returns immediately when `resources` are bundled), and call `syncReminderNotifications` from the `resolvedLanguage` effect so scheduled text follows the app language.

### A38. [MEDIUM · bug] LockScreen re-prompts on every 'active' transition, so a cancelled biometric prompt immediately reopens
**Where:** `app/components/LockScreen.tsx:61`  ·  **Verifiers upholding:** 3/3

**What:** LockScreen calls attempt() on every AppState 'active' event (:59-62) with only busyRef/doneRef guards; the OS credential prompt's own dismissal emits 'active' after authenticate() has resolved (as the comment at :25-29 documents), so a cancelled or failed prompt (status 'idle'/'failed', busyRef false) immediately re-opens the prompt - the user cannot dismiss it except via Home. Lockout does not loop (no UI is shown, so no extra 'active' fires). Fix: only auto-prompt on a background/inactive -> active transition and swallow the first 'active' following a resolved authenticate() call.

**Evidence:** app/components/LockScreen.tsx:59-62 `if (AppState.currentState === 'active') attempt(); const sub = AppState.addEventListener('change', nextState => { if (nextState === 'active') attempt(); });` Guards at :33 are only `busyRef.current || doneRef.current`; `doneRef` is set only on success (:38-39) and `busyRef` is reset in `finally` (:48). The file's own comment at :26-29 confirms the ordering: "A stray 'active' AppState event (e.g. the OS credential prompt itself closing) can fire in that gap" — i.e. after the promise has resolved. For `user_cancel` the code sets status 'idle' (:43) and nothing blocks the next 'active'.

**What goes wrong:** App Lock on, app foregrounded → prompt shown → user taps Cancel (wants to go to the home screen first) → `authenticateAsync` resolves `{success:false, error:'user_cancel'}` → busyRef=false, status 'idle' → the prompt-close 'active' event fires → attempt() → prompt shown again immediately. Same after 'lockout': each foreground re-triggers a prompt that the OS instantly rejects. Ordering-dependent, but it is exactly the ordering the author documented for the success case.

**Suggested fix:** Only auto-prompt on a real background→foreground transition: track the previous AppState and call attempt() when `prev === 'background' && next === 'active'`, and/or set a `promptingRef` before `authenticate()` that swallows the first 'active' event after the call resolves. Keep the manual Unlock button for retries.

### A39. [MEDIUM · bug] Automatic language never matches Indonesian on Android (device reports legacy code 'in')
**Where:** `app/contexts/LanguageContext.tsx:58`  ·  **Verifiers upholding:** 3/3

**What:** On Android, 'Automatic' language never resolves to Indonesian: `resolveAutomaticLanguage` matches the raw `languageCode` ('in', Java's legacy ISO code from `Locale.getLanguage()`) against SUPPORTED_LANGUAGES' 'id', so Indonesian devices fall back to English and the Language screen reports "Matches your device (English)". Only Indonesian is affected (the other legacy codes, he/yi, aren't supported); manual selection still works.

**Evidence:** app/contexts/LanguageContext.tsx:49 `const languageCode = locale?.languageCode ?? '';` and :58 `(SUPPORTED_LANGUAGES as readonly string[]).includes(languageCode)`; app/i18n/index.ts:35 lists `'id'`. node_modules/expo-localization/android/src/main/java/expo/modules/localization/LocalizationModule.kt:141 `"languageCode" to locale.language` (raw `Locale.getLanguage()`, documented to return the old codes `in`/`iw`/`ji`), while :136 exposes `"languageTag" to locale.toLanguageTag()` which is BCP-47 (`id-ID`). No normalisation in the file.

**What goes wrong:** Android phone set to Bahasa Indonesia, Language = Automatic: `includes('in')` is false → UI in English although id.json ships; the Language screen's Automatic row says "Matches your device (English)" (app/language.tsx:37).

**Suggested fix:** Match on `languageTag` (split on '-') or map legacy codes (`in→id`, `iw→he`, `ji→yi`) before the `includes()` check; add a unit test for the mapping.

### A40. [MEDIUM · bug] Multi-statement writes (saveEntry, updateEntry, importEntries) run outside transactions
**Where:** `app/db/queries.ts:275`  ·  **Verifiers upholding:** 3/3

**What:** saveEntry (queries.ts:434-452), updateEntry (:275-283) and importEntries (:343-356) issue 1+N+M separate autocommit statements with no withTransactionSync; updateEntry in particular deletes all join rows before re-inserting, so an interrupted or failing edit leaves an entry with lost sound types/triggers, and large imports pay a per-statement commit on the JS thread.

**Evidence:** queries.ts:434-452 (saveEntry) `db.runSync('INSERT INTO entries ...')` then `for (const typeId of data.typeIds) db.runSync('INSERT INTO entry_tinnitus_types ...')` and the same for triggers; :275-283 (updateEntry) `DELETE FROM entry_tinnitus_types WHERE entry_id = ?` followed by per-id inserts; :343-356 (importEntries) same shape in a loop over every backup row. No 'transaction' string in app/db/database.ts or queries.ts (both read fully).

**What goes wrong:** User edits an entry's triggers and the OS kills the app between the DELETE and the INSERTs (or a UNIQUE/NOT NULL error fires on one insert) -> entry keeps intensity but loses all triggers, silently changing the Trigger Impact model inputs. Importing a 2,000-entry backup (~6,000 statements, each its own fsync) freezes the UI for seconds because the SQLite API is synchronous.

**Suggested fix:** Wrap saveEntry, updateEntry, importEntries (and deleteEntry once it deletes join rows) in `db.withTransactionSync(() => { ... })`; this also makes the import ~10-50x faster.

### A41. [MEDIUM · bug] Deleting an entry orphans its join rows, so a custom trigger/sound type used only on deleted entries can never be deleted
**Where:** `app/db/queries.ts:286`  ·  **Verifiers upholding:** 3/3

**What:** `deleteEntry` (queries.ts:286-288) deletes only the `entries` row; foreign keys are never enabled (DB opened plainly at database.ts:4, no `PRAGMA foreign_keys`), so the schema's `ON DELETE CASCADE` never fires and `entry_triggers`/`entry_tinnitus_types` rows are orphaned. Usage counts (queries.ts:110, :148-150) and the delete guards (:134, :172) count join rows without joining `entries`, so a custom trigger or sound type used only on since-deleted entries is reported as "used on past entries" and can be disabled but never deleted (app/triggers.tsx:72, app/sound-types.tsx:72). Stats are unaffected because join rows are keyed by entry_id and AUTOINCREMENT ids are not reused.

**Evidence:** app/db/queries.ts:286-288: `deleteEntry(id) { db.runSync('DELETE FROM entries WHERE id = ?', [id]); }`. No `PRAGMA foreign_keys` anywhere (grep), which `deleteAllEntries` (queries.ts:395-400) explicitly works around by deleting both join tables. `getTriggersForManagement` (queries.ts:146-154) computes `COUNT(et.entry_id)` via `LEFT JOIN entry_triggers` with no join to `entries`, so orphans count. app/triggers.tsx:72-75 blocks delete when `usageCount > 0`, and `deleteTrigger` (queries.ts:171-175) refuses on the same count.

**What goes wrong:** User adds custom trigger 'Flight', logs one entry with it, then deletes that entry. In Profile > Triggers the trash icon is greyed and tapping it shows 'This trigger has been used on past entries' although no entry references it; the trigger can only be disabled, never removed.

**Suggested fix:** Delete the entry's join rows in `deleteEntry` (or enable `PRAGMA foreign_keys = ON` at open), and make the usage-count queries join through `entries` so historical orphans stop counting.

### A42. [MEDIUM · bug] deleteEntry leaves orphan join rows; FK cascade is inert
**Where:** `app/db/queries.ts:287`  ·  **Verifiers upholding:** 3/3

**What:** deleteEntry (queries.ts:286-288) deletes only from `entries`; because no `PRAGMA foreign_keys = ON` is ever issued (expo-sqlite defaults to OFF), the `ON DELETE CASCADE` on entry_tinnitus_types/entry_triggers (database.ts:39,45) is inert, so join rows are orphaned. The management screens' usage_count queries (queries.ts:110-112, 148-150) and the deleteTrigger/deleteTinnitusType guards (queries.ts:134-135, 172-173) count join rows without joining entries, so a custom trigger/sound type used on a since-deleted entry is shown as 'in use' and can never be deleted (app/triggers.tsx:72, app/sound-types.tsx:72).

**Evidence:** queries.ts:286-288: `export function deleteEntry(id) { db.runSync('DELETE FROM entries WHERE id = ?', [id]); }` — no join-table delete. No `PRAGMA foreign_keys` in app/, src/ or node_modules/expo-sqlite (grep), and CLAUDE.md itself states cascade is inert; `deleteAllEntries` (queries.ts:395-400) clears both join tables explicitly, showing the author knew. `getTriggersForManagement` (queries.ts:146-154) computes `COUNT(et.entry_id) AS usage_count` from the join table alone without joining `entries`; `deleteTrigger` (171-175) refuses when `cnt > 0` using the same join-table-only count; app/triggers.tsx:72 `if (row.usageCount > 0) { setBlockedInfo(true); return; }`.

**What goes wrong:** User creates custom trigger 'Foo', logs one entry with it, then deletes that entry from the edit screen. Profile > Triggers now shows 'Foo' as used 1x; tapping the trash icon shows the 'in use' dialog and the trigger can never be deleted (same for custom sound types). The orphan rows also persist forever in the DB and are included in every export's usage counts.

**Suggested fix:** In `deleteEntry`, delete from both join tables (and `prompts.entry_id` if kept) inside `db.withTransactionSync`, or run `PRAGMA foreign_keys = ON` immediately after `openDatabaseSync`. Also make `usage_count` join through `entries` so stale rows can't block deletion.

### A43. [MEDIUM · bug] Deleting an entry leaves orphaned join rows, inflating usage counts so custom triggers/sound types become undeletable
**Where:** `app/db/queries.ts:287`  ·  **Verifiers upholding:** 3/3

**What:** deleteEntry deletes only the entries row; with no PRAGMA foreign_keys the schema's ON DELETE CASCADE/SET NULL never run, so entry_triggers/entry_tinnitus_types rows (and prompts.entry_id) are orphaned. Management usage counts and the deleteTrigger/deleteTinnitusType guards count those join rows without joining entries, so a custom trigger/sound type used only on a since-deleted entry stays permanently undeletable. No health-data corruption (entries.id is AUTOINCREMENT so ids are never reused; stats and export key by live entry ids).

**Evidence:** app/entry/[id].tsx:290 calls `deleteEntry(Number(id))`; app/db/queries.ts:286-288 runs only `DELETE FROM entries WHERE id = ?`. app/db/database.ts has no `PRAGMA foreign_keys` (grep shows only `PRAGMA table_info`), and CLAUDE.md notes cascade is inert — which is why deleteAllEntries (queries.ts:395-399) wipes the join tables explicitly. getTriggersForManagement (queries.ts:146-153) counts `COUNT(et.entry_id)` with no join to entries; app/triggers.tsx:72 and :129 block deletion when `usageCount > 0`.

**What goes wrong:** User adds custom trigger "Flight", logs one entry with it, then deletes that entry. On Profile > Triggers the row still shows usage 1 and the trash icon is disabled; deleteTrigger would no-op. The orphan rows are also exported nowhere and accumulate forever.

**Suggested fix:** In deleteEntry, delete from entry_tinnitus_types and entry_triggers (and null out prompts.entry_id) in the same transaction before deleting the entry, or enable `PRAGMA foreign_keys = ON` at open time so the schema's cascades work.

### A44. [MEDIUM · bug] importEntries has no transaction and almost no validation: partial imports and out-of-range values
**Where:** `app/db/queries.ts:334`  ·  **Verifiers upholding:** 3/3

**What:** importEntries (queries.ts:334-363) inserts each backup row with autocommitting runSync calls and no transaction; validation is only `created_at` truthiness and `typeof intensity === 'number'` (line 339). An unparseable created_at throws RangeError from computeLocalDate mid-loop, leaving earlier rows committed (duplicates on retry), and out-of-range/non-integer intensities insert freely and corrupt the Stats distribution (bogus level row, NaN mode, skewed percentages). getDeviceTimeZone() is also re-evaluated per row.

**Evidence:** queries.ts:339 `if (!e.created_at || typeof e.intensity !== 'number') continue;` is the only validation. Lines 341-345 call `computeLocalDate(e.created_at, timezone)` which (datetime.ts:62-71) does `formatToParts(new Date(iso))` — RangeError on an unparseable string. No `withTransactionSync` anywhere in app/ or src/ (grep). my-data.tsx:200-211 catches the error and shows 'import failed' without rolling back. Downstream, app/(tabs)/trends.tsx:90-91 does `const counts = [0,0,0,0,0,0]; for (const item of items) counts[item.intensity]++;` and line 128 `SCALE_COLORS[level]`. `getDeviceTimeZone()` is also called per row (line 341), constructing a new `Intl.DateTimeFormat` each time — the exact cost datetime.ts:40-43 warns about.

**What goes wrong:** (A) An 800-entry backup where row 500 has `created_at: "2026-13-45"`: rows 1-499 are committed, `formatToParts` throws, user sees 'Import failed', fixes the file, re-imports → 499 duplicates. (B) A hand-edited or foreign backup with `intensity: 7` or `2.5`: insert succeeds (no CHECK constraint), `counts[7]++` yields NaN/undefined buckets, `SCALE_COLORS[7]`/`INTENSITY_LABELS[7]` are undefined in the distribution card. (C) `created_at: "2026-10-05"` (no time) sorts before every `2026-10-05T...` value in `ORDER BY created_at`, misordering the recent list.

**Suggested fix:** Wrap the loop in `db.withTransactionSync(() => {...})`; validate `Number.isInteger(intensity) && intensity >= 0 && intensity <= 5`, `!Number.isNaN(Date.parse(created_at))`, and the enum fields against the `Pitch`/`Location`/`DurationPattern`/`Distress` unions, skipping or rejecting bad rows up front; hoist `getDeviceTimeZone()` out of the loop. Apply the same transaction wrap to `saveEntry` (416-455) and `updateEntry` (247-284) so an entry can never be left without its join rows.

### A45. [MEDIUM · bug] Import is not transactional: a failure mid-file leaves a partial import behind an 'Import Failed' dialog
**Where:** `app/db/queries.ts:338`  ·  **Verifiers upholding:** 3/3

**What:** `importEntries` runs one autocommitting `runSync` per entry (and per join row) with no `withTransactionSync`; a throw on a later entry (e.g. unparseable `created_at` → `formatToParts` RangeError at datetime.ts:63, or a non-bindable field value) leaves earlier entries committed while my-data.tsx:209-211 shows "Import Failed", so a retry duplicates them.

**Evidence:** app/db/queries.ts:338-359 loops `for (const e of entries) { ... db.runSync('INSERT INTO entries ...') ... }` with no transaction wrapper; a repo-wide grep for `withTransactionSync|BEGIN` returns nothing, although expo-sqlite 55.0.15 exposes `withTransactionSync(task: () => void): void` (node_modules/expo-sqlite/build/SQLiteDatabase.d.ts:191). app/my-data.tsx:209-211 catches and shows `myData.importFailedTitle`.

**What goes wrong:** A 500-entry backup where entry #300 has `created_at: "2026-13-45"` (or a non-string `note`): `computeLocalDate` → `new Date('2026-13-45')` → `formatToParts` throws RangeError. 299 entries are already committed; the user sees 'Import Failed', assumes nothing was imported, fixes the file and imports again → 299 duplicate entries.

**Suggested fix:** Wrap the whole loop in `db.withTransactionSync(() => { ... })` so a failed import rolls back completely, and validate every entry before inserting any.

### A46. [MEDIUM · bug] Import validation only checks `created_at` is truthy and `intensity` is a number — out-of-range and wrong-typed values are persisted
**Where:** `app/db/queries.ts:339`  ·  **Verifiers upholding:** 3/3

**What:** importEntries validates only `created_at` truthy + `intensity` is a number, runs outside a transaction, and never reports skipped rows: out-of-range/float intensity and arbitrary pitch/impact/duration/location/note values are persisted (reports then show distribution percentages that don't sum to 100 and a trend point outside the SVG; Home/calendar colours clamp via intensityColor and are unaffected), an unparseable `created_at` throws from computeLocalDate mid-loop leaving earlier rows committed behind an "Import failed" dialog, and `schema_version` is written on export but never checked on import.

**Evidence:** app/db/queries.ts:339: `if (!e.created_at || typeof e.intensity !== 'number') continue;` is the only check before the INSERT on 343-345 (`e.pitch ?? null, e.impact ?? null, ...` bound verbatim). app/my-data.tsx:198 only checks `Array.isArray(parsed?.entries)` and ignores `parsed.schema_version` (written at line 138). Downstream, src/features/reports/reportData.ts:84 builds `counts` for levels 0–5 only while line 108 divides by `values.length`, and app/constants/theme.ts:1 `SCALE_COLORS` has 6 entries.

**What goes wrong:** A hand-edited or corrupted backup with `intensity: 9` (or `3.5`) is imported successfully. In the PDF the distribution rows no longer sum to 100% (the entry is in the denominator but in no row), the trend polyline point is drawn above the SVG viewBox (reportHtml.ts:27 `(5 - 9)/5` is negative), and the Home/calendar colour lookup `SCALE_COLORS[9]` is `undefined`. Nothing in the UI can repair it short of Delete All Data. Separately, entries silently skipped by line 339 are never reported — 'Import Complete: N entries' hides them.

**Suggested fix:** Validate each entry against the DB types (integer intensity 0–5, enum values from app/db/types.ts, string|null note, parseable ISO date) and reject the file (inside the transaction) with a count of invalid rows; check `schema_version <= SCHEMA_VERSION`.

### A47. [MEDIUM · bug] Import runs row-by-row with no transaction, so a bad row leaves a half-imported, duplicable dataset
**Where:** `app/db/queries.ts:339`  ·  **Verifiers upholding:** 3/3

**What:** importEntries inserts entries and join rows one runSync at a time with no transaction (no withTransactionSync anywhere in app/ or src/); the only per-row guard is `!e.created_at || typeof e.intensity !== 'number'`, so a row with an unparseable created_at (e.g. "2026-13-01" or non-date text → RangeError from computeLocalDate via Intl formatToParts) or a non-iterable tinnitus_types/triggers (e.g. a number → TypeError at the for-of) throws mid-loop, leaving all earlier rows committed while my-data.tsx shows "import failed" and never refreshes; a retry with a fixed file duplicates those rows. updateEntry's DELETE-then-INSERT of join rows is likewise unprotected.

**Evidence:** queries.ts:338-359 `for (const e of entries) { ... db.runSync('INSERT INTO entries ...') ... db.runSync('INSERT INTO entry_tinnitus_types ...') ... }` with no `withTransactionSync` (grep over app/ and src/ finds no transaction use; expo-sqlite exposes `withTransactionSync(task: () => void)` at node_modules/expo-sqlite/build/SQLiteDatabase.d.ts:191). my-data.tsx:209-212 catches and shows `myData.importFailedMessage` ("This file could not be read..."). `computeLocalDate` (datetime.ts:69-71 -> `formatToParts(new Date(iso))`) throws RangeError for any unparseable `created_at`, and `for (const name of e.tinnitus_types ?? [])` at :349 throws TypeError if that field is a number.

**What goes wrong:** A 300-entry backup whose 150th entry has `created_at: "2026-02-30"` (or `tinnitus_types: 5`): rows 1-149 are inserted, row 150 throws, the dialog says the file could not be read. The user fixes the file (or just retries) and imports again: rows 1-149 now exist twice. Same applies to `updateEntry` (:268-283) and `saveEntry` (:434-452), where a crash between the DELETE and the re-INSERT of join rows silently drops an entry's sound types/triggers.

**Suggested fix:** Wrap the whole import in `db.withTransactionSync(() => { ... })` so a failure rolls everything back and the 'could not be read' message is actually true; do the same for `updateEntry` and `saveEntry`. Validate the file fully (previous finding) before starting the transaction so the common case never rolls back.

### A48. [MEDIUM · bug] Out-of-range intensity is clamped to 'Severe' on Home/Calendar and survives the edit screen with nothing selected
**Where:** `app/db/queries.ts:339`  ·  **Verifiers upholding:** 3/3

**What:** importEntries only checks `typeof e.intensity === 'number'`, so an out-of-range intensity (e.g. 8) from a backup is inserted as-is; IntensityIcon/intensityColor then clamp it to Severe on Home/Calendar, and the edit screen loads it with no scale button selected yet lets Save re-persist it because the only guard is `intensity === null`.

**Evidence:** app/components/intensity/IntensityIcon.tsx:45 `const Icon = icons[Math.max(0, Math.min(level, 5)) ...]`; app/constants/theme.ts:5 `SCALE_COLORS[Math.max(0, Math.min(v, 5))]`; app/entry/[id].tsx:57 `const selected = value === i;` (i ranges 0–5, so 8 matches nothing) and [id].tsx:254 `if (intensity === null)` is the only save guard, so Save stays enabled and updateEntry writes 8 back. Git: `git log -S'1–10'` finds no entry form with a 10-point scale (f1b5183's add.tsx already used `Array.from({ length: 5 })`), so no legacy source exists other than a hand-edited backup.

**What goes wrong:** Import a backup containing `"intensity": 8`. Home's recent-entries row and the Calendar day cell show the Severe (level 5) icon/colour with no indication the stored value is invalid; opening the entry shows the six scale buttons all unselected; tapping Save without touching intensity keeps 8 in the DB. (The Stats crash from the same row is already catalogued.)

**Suggested fix:** Clamp or reject at the write boundary (importEntries/updateEntry: `Number.isInteger(v) && v >= 0 && v <= 5`), and in the edit screen treat an out-of-range loaded value as null so the user must re-select before saving.

### A49. [MEDIUM · bug] Backup omits timezone/local_date/source, so restores re-bucket days in the importing device's zone
**Where:** `app/db/queries.ts:341`  ·  **Verifiers upholding:** 3/3

**What:** importEntries recomputes local_date from the importing device's current timezone (and omits source) because the export payload in app/my-data.tsx:141-151 never carries timezone/local_date/source; restoring a backup on a device in a different zone shifts late-evening/early-morning entries to an adjacent day in the calendar, trend, reports and achievement day counts, and source provenance is replaced by backfillLegacySource's guess on next launch.

**Evidence:** my-data.tsx:141-151 maps each entry to `created_at, intensity, duration, location, pitch, impact, note, tinnitus_types, triggers` — no `timezone`, `local_date` or `source`. queries.ts:341-345: `const timezone = getDeviceTimeZone(); const localDate = computeLocalDate(e.created_at, timezone);` and the INSERT column list excludes `source`, leaving it NULL until the next launch's `backfillLegacySource` (database.ts:141-161) relabels it.

**What goes wrong:** User logs at 23:30 in New York (local_date Oct 4), exports, later moves to London, uses Delete All + Import to restore: local_date becomes Oct 5 for that entry and every other late-evening one. Calendar, day-of-week stats and trigger-day grouping all shift; streak/achievement day counts can change. Entries that were 'scheduled' come back as 'legacy'/'self_initiated'.

**Suggested fix:** Add `timezone` (and `source`) to the export payload and bump `SCHEMA_VERSION`; on import, use the stored timezone for `computeLocalDate` and fall back to the device zone only for version-1 backups.

### A50. [MEDIUM · bug] Double-tapping Save inserts the same entry twice
**Where:** `app/entry/new.tsx:307`  ·  **Verifiers upholding:** 3/3

**What:** handleSave has no re-entry guard and the Save PressableScale (lines 503-507) is never disabled, so a second tap in the 200 ms before router.back() inserts a duplicate entry, double-fires analytics/achievement sync, and queues a second router.back(); app/entry/[id].tsx:253-282/486-490 shares the pattern (idempotent update, but duplicate events and extra back navigation).

**Evidence:** new.tsx:307-336 `function handleSave() { if (intensity === null) {...} saveEntry({...}); logEvent('entry_logged'); syncAchievements(); setSaved(true); setTimeout(() => router.back(), 200); }` and :503-507 `<PressableScale onPress={handleSave} style={[...]} size="large">` with no `disabled`. Compare app/onboarding/disclaimer.tsx:18-24 `// Guards a double-tap: PressableScale's own scale animation leaves a brief window where a second tap can fire before navigation actually happens.` Same pattern in app/entry/[id].tsx:253-282, 486-490 (idempotent update, but duplicate analytics/achievement sync).

**What goes wrong:** User taps Save twice quickly (common on a bouncy button): two identical rows for the same minute appear on Home and Calendar, the Entries tile and "x of N days" count go up by two, and the 'detailed_check_in'/streak logic sees two check-ins.

**Suggested fix:** Add a `savingRef`/`saved` guard at the top of handleSave and pass `disabled={saved}` to the PressableScale (and the same in [id].tsx).

### A51. [MEDIUM · bug] On iOS the date/time pickers are never dismissed and stay inlined in the layout
**Where:** `app/entry/new.tsx:386`  ·  **Verifiers upholding:** 3/3

**What:** On iOS the date/time pickers are never dismissed: `onChange` sets the show flag to `Platform.OS === 'ios'` (always true there) and nothing else sets it false, so the compact native control stays inlined between the header and the ScrollView for the life of the screen (same at app/entry/[id].tsx:350/361).

**Evidence:** app/entry/new.tsx:380-401: `{showDatePicker && <DateTimePicker ... onChange={(event, selected) => { setShowDatePicker(Platform.OS === 'ios'); ... }} />}` with no `display` prop and no close/done affordance; identical at app/entry/[id].tsx:344-365. @react-native-community/datetimepicker 8.6.0 README ("display" section) says iOS `default` picks compact/inline on iOS 14+, i.e. an always-visible control, and src/datetimepicker.ios.js:30-45 only falls back to spinner below iOS 14. Nothing on either screen calls setShowDatePicker(false)/setShowTimePicker(false) on iOS.

**What goes wrong:** iOS user taps the date in the header. An unstyled compact date picker appears above the intensity card and remains there for the life of the screen; tapping the time adds a second one. They cannot be hidden, and they shift the whole form down.

**Suggested fix:** On iOS render the picker inside a modal/bottom sheet with a Done button that sets the show flag to false (or use `display="inline"` inside a dismissible container); on Android keep the current dialog flow.

### A52. [MEDIUM · bug] iOS export leaves the full-diary JSON in the cache forever and records 'export completed' even when the user cancels
**Where:** `app/my-data.tsx:163`  ·  **Verifiers upholding:** 3/3

**What:** iOS export writes the full diary JSON to Paths.cache and never deletes it (lines 163-169; unlike reportExport.ts:16-19), and then unconditionally sets last_exported_at and logs export_completed (lines 172-175) even when Sharing.isAvailableAsync() is false or the share sheet is dismissed — the Android branch's `if (!saved) return` guard (line 159) has no iOS counterpart.

**Evidence:** app/my-data.tsx:163-169 creates `tinnitus-tracker-backup-<date>.json` in cache and calls `Sharing.shareAsync` only `if (await Sharing.isAvailableAsync())`; no delete follows. Lines 172-175 then run `setSetting('last_exported_at', now); ... logEvent('export_completed', ...)` regardless. Contrast src/features/reports/reportExport.ts:17-19: 'Keeping reports in cache would leave sensitive health summaries behind with no user-visible way to remove them.'

**What goes wrong:** iOS user taps Export, the share sheet opens, they tap Cancel. My Data now shows 'Last exported today' and analytics records a completed export, although no file was saved anywhere the user can find; meanwhile a copy of every entry and note sits in the app cache indefinitely (one file per date).

**Suggested fix:** Delete the cache file after `shareAsync` resolves (or on next launch), and on iOS only set `last_exported_at`/log the event when sharing was actually available; treat `isAvailableAsync() === false` as an error state with a dialog.

### A53. [MEDIUM · bug] Linking.openURL calls are unhandled, so "Email Support" and the legal/website links silently do nothing when no handler app exists
**Where:** `app/support.tsx:54`  ·  **Verifiers upholding:** 3/3

**What:** Six Linking.openURL call sites ignore the returned promise (support.tsx:54, about.tsx:14, connect.tsx:43, learn/[slug].tsx:55, (tabs)/more.tsx:133, and support-directory.tsx:139), so a mailto: with no mail client or a blocked https: handler rejects silently with no user feedback; only support-directory.tsx:73-79 handles the rejection with a StatusDialog.

**Evidence:** support.tsx:54 `Linking.openURL(url);` (mailto: with subject/body), about.tsx:14 `const openUrl = (url) => () => Linking.openURL(url);`, connect.tsx:43, learn/[slug].tsx:55, more.tsx:133 `Linking.openURL(managementUrl ?? PLAY_SUBSCRIPTIONS_URL);`. Contrast support-directory.tsx:73-79 `try { await Linking.openURL(item.url); } catch { setLinkError(true); }` with a StatusDialog.

**What goes wrong:** iPhone with the Mail app removed (or an Android profile without an email client): user taps "Email Support" on the Contact Support screen, the button animates, nothing opens, no message — the one screen whose purpose is reaching a human fails silently.

**Suggested fix:** Reuse the support-directory pattern: await/catch and show a StatusDialog (localSupport.openErrorTitle/Body already exist), or check canOpenURL first and offer to copy the address.

### A54. [MEDIUM · bug] PDF is deleted the instant the Android chooser returns, before the receiving app has necessarily read it
**Where:** `src/features/reports/reportExport.ts:19`  ·  **Verifiers upholding:** 3/3

**What:** The report PDF is deleted in `finally` as soon as `Sharing.shareAsync` resolves, but on Android that promise resolves in `OnActivityResult` when the chooser closes (SharingModule.kt:80-84) and the receiver only holds a FileProvider URI to the cache file (no copy, SharingModule.kt:31-49); a target app that reads the stream lazily (on send/upload) gets a missing file. The comment "The receiving app gets its own copy" is incorrect. Defer cleanup (e.g. purge stale report files on next launch / next report creation) instead of deleting synchronously.

**Evidence:** src/features/reports/reportExport.ts:16-20: `finally { if (file.exists) file.delete(); }` right after `await Sharing.shareAsync(...)`. node_modules/expo-sharing/android/src/main/java/expo/modules/sharing/SharingModule.kt:52 `startActivityForResult(intent, REQUEST_CODE)` and :80-83 `OnActivityResult { ... pendingPromise?.resolve(null) }` — the promise resolves on the chooser's result, and the receiver only holds a FileProvider URI granted on line 48-50.

**What goes wrong:** User taps 'Create and Share PDF', picks an app that attaches content URIs lazily (reads the stream when the message/upload is actually sent, or after its compose screen finishes loading). By then `file.delete()` has run and the attachment fails with a 'file not found' / empty attachment. Plausible rather than confirmed on-device — depends on the receiver's read timing.

**Suggested fix:** Defer deletion: e.g. delete stale report files on the next app launch / next report creation, or on `AppState` returning to 'active' after a share, rather than synchronously after `shareAsync` resolves.

### A55. [MEDIUM · bug] Report PDF is deleted the instant the Android share chooser hands off, before the target app has read it; cancel still counts as shared
**Where:** `src/features/reports/reportExport.ts:19`  ·  **Verifiers upholding:** 3/3

**What:** On Android the report PDF is deleted in `finally` as soon as `Sharing.shareAsync` resolves, which happens in `OnActivityResult` when the chooser closes — before the target app has read the FileProvider URI — so lazily-reading targets get a missing/empty attachment. On both platforms the promise also resolves on cancel (Android: unconditional in OnActivityResult; iOS: `type == nil && !completed` branch), so `reports.tsx:48` unlocks `first_report` for a dismissed share sheet.

**Evidence:** reportExport.ts:10-19 `await Sharing.shareAsync(result.uri, {...}); return true; } finally { if (file.exists) file.delete(); }`. node_modules/expo-sharing/android/.../SharingModule.kt:52 `startActivityForResult(intent, REQUEST_CODE)` and :80-84 `OnActivityResult { ... pendingPromise?.resolve(null) }` — the chooser finishes as soon as a target is picked (and also on cancel), so the promise cannot distinguish success from dismissal. reports.tsx:48 `if (shared) unlockEvent('first_report');` treats any resolution as a completed share.

**What goes wrong:** Android user taps Create report and picks Google Drive / Gmail / a messaging app. The chooser returns immediately, `file.delete()` runs, and the target app's background read of the FileProvider URI fails with 'file not found' or an empty attachment; the app has already shown success. Separately, a user who opens the chooser and backs out still unlocks the 'first_report' milestone and reports.tsx shows no error.

**Suggested fix:** On Android do not delete immediately: keep the PDF in cache and clean up stale report files on the next app launch or next createAndShareReport call (e.g. delete anything older than a few minutes in a dedicated reports/ cache subfolder); iOS can keep the immediate delete since its completion handler fires after the activity completes. Treat `shareAsync` resolution as 'chooser dismissed', not 'shared': do not unlock first_report from it on Android, or only unlock on iOS where `completed` is reported.

### A56. [MEDIUM · code-quality] hexToRgba copied 23 times, makeStyles boilerplate 38 times, back-button header and modal shells duplicated per file
**Where:** `app/settings.tsx:18`  ·  **Verifiers upholding:** 3/3

**What:** hexToRgba is copy-pasted verbatim in 23 files (plus withAlpha in trends.tsx:185 and the same parse in theme.ts:8-14); 38 files hand-roll makeStyles(colors); ~24 sub-screens repeat the identical back-button header JSX and styles, which have already drifted into two incompatible looks (18 screens: borderRadius 12 + shadow + 17/700 title; 6 newer screens: borderRadius 19, no shadow, 22/800 title); five modal components (ConfirmDialog, StatusDialog, EditNameModal, AddItemModal, AddReminderModal) duplicate the same overlay/card/inner/btnRow styles and spring animation. ScreenHeader exists but covers only the three tab screens and rebuilds its StyleSheet every render.

**Evidence:** `grep -rn 'function hexToRgba' app src` -> 23 files (settings.tsx:18, my-data.tsx:31, (tabs)/index.tsx:28, entry/new.tsx:42, ConfirmDialog.tsx:16, ...); trends.tsx:185 `withAlpha`; theme.ts:8-14 scaleColor does the same parse. `grep -rl makeStyles app src` -> 38 files. Header block e.g. settings.tsx:94-99 + :192-218 vs profile.tsx:69-74 + :153-178 vs triggers.tsx:104-109 + :202-227 (identical); drift: backBtn `borderRadius: 12` (settings.tsx:203) vs `19` (achievements.tsx:125, reports.tsx:128, learn/index.tsx:85) and headerTitle 17/700 vs 22/800. ScreenHeader.tsx exists but is used only by the three tab screens and rebuilds its StyleSheet every render (:21). ConfirmDialog.tsx:74-156, StatusDialog.tsx:76-142, EditNameModal.tsx:97-189, AddItemModal.tsx:107-216, AddReminderModal.tsx:129-252 share overlay/card/inner/btnRow/btn styles.

**What goes wrong:** A design change to the back button, card shadow or dialog radius must be made in 20-38 files and will be missed (it already was: two back-button shapes and two header type scales coexist across sub-screens).

**Suggested fix:** Add app/utils/color.ts (`withAlpha`), a `useThemedStyles(makeStyles)` hook, a `BackHeader` component used by every sub-screen, and a `DialogShell` that the five modals compose; delete the local copies as each file is touched.

### A57. [MEDIUM · code-quality] Six settings screens and the Triggers/Sound Types screens are near-verbatim copies; hexToRgba is defined in 23 files
**Where:** `app/sound-types.tsx:1`  ·  **Verifiers upholding:** 3/3

**What:** app/sound-types.tsx is a token-renamed byte-identical copy of app/triggers.tsx (353 lines, empty normalised diff); five choice-setting screens (appearance, language, first-day-of-week, default-chart-type, app-lock) plus the card-based icon-style screen each re-declare the same header/row/footer stylesheet and have already drifted on the selected background (surfaceAlt in appearance.tsx:151 / icon-style.tsx:155 vs isDark ? hexToRgba(primary,0.18) : '#EFF6FF' in language.tsx:164, first-day-of-week.tsx:163, default-chart-type.tsx:156, app-lock.tsx:179); hexToRgba is re-defined in 23 files with no theme.ts export; StatTile (index.tsx:64 / trends.tsx:1413), MenuRow/Row (more.tsx:33, settings.tsx:25, about.tsx:16, my-data.tsx:66) and the bars/line toggle (app/components/charts/IntensityTrendChart.tsx:426 ChartTypeToggle vs inline re-implementation at trends.tsx:1682) are duplicated too.

**Evidence:** `diff` of triggers.tsx vs sound-types.tsx with Trigger/SoundType tokens normalised → empty (353 lines each). grep `^function hexToRgba` → 23 files. Selected-row drift: appearance.tsx:151-154 and icon-style.tsx:155-158 use `backgroundColor: colors.surfaceAlt`, while language.tsx:164-167, first-day-of-week.tsx:163-166, default-chart-type.tsx:156-159, app-lock.tsx:179-182 use `isDark ? hexToRgba(colors.primary, 0.18) : '#EFF6FF'`. StatTile: index.tsx:64-79 vs trends.tsx:1413-1423; bars/line toggle: IntensityTrendChart.tsx:426-455 vs trends.tsx:1682-1700; MenuRow: more.tsx:33-77, settings.tsx:25-64, about.tsx:16-43, my-data.tsx:66-106.

**What goes wrong:** Any design change to the settings screens (e.g. the contrast fix above, or the tap-target fix) has to be applied in 8+ places and will be missed in some, as the selected-row background already was.

**Suggested fix:** Extract `ChoiceSettingScreen<T>` (title, intro, options, pending/save), a `ManageItemsScreen` shared by triggers/sound-types, a `SettingsRow`, and move hexToRgba/withAlpha into constants/theme.ts.

### A58. [MEDIUM · code-quality] Anchor check-in subsystem (prompts table, source column, 9 queries, 90 lines of scheduling) is dead code shipped with a migration that runs every launch
**Where:** `app/utils/notifications.ts:73`  ·  **Verifiers upholding:** 3/3

**What:** The anchor check-in subsystem is unreachable: `startAnchorEra` is never called, so `settings.anchor_era_start` is never set, `scheduleAnchorIfNeeded`/`rearmPendingAnchor` always early-return (notifications.ts:74, :143), `defaultEntrySource()` always returns 'legacy' (queries.ts:24), the `prompts` table is never written, no `addNotificationResponseReceivedListener` exists, and the `entries.source` column is never read by any stats code despite database.ts:139-140 claiming the inferential model filters on it. Also `anchor_window_start/end` settings (notifications.ts:49-50) have no writer. Either wire it (onboarding → startAnchorEra, startup → scheduleAnchorIfNeeded, response listener → markPromptOpened, stats model → filter by source) or remove the table/column/queries/i18n keys and fix the comments in database.ts and queries.ts.

**Evidence:** `grep -rnE 'scheduleAnchorIfNeeded|startAnchorEra|markPromptOpened|addNotificationResponseReceivedListener' app src` outside notifications.ts/queries.ts -> no matches. `grep -n source app/stats/*.ts` -> only comments. database.ts:59-83 prompts table, :96-98 `ensureColumn('entries','source','TEXT'); backfillTimezoneAndLocalDate(); backfillLegacySource();`, :139-141 comment claims 'the inferential model reads only entries from the anchor era'. queries.ts:5-99 nine exported functions; notifications.ts:31-107 and :140-159; en.json:647 `anchor` keys in all 28 locales.

**What goes wrong:** Every launch runs backfillLegacySource's COUNT query against a column nothing reads; new contributors (and CLAUDE.md readers) believe entry provenance is modelled when it is not; the schema and i18n carry a feature that cannot be reached by any user.

**Suggested fix:** Either wire it (call startAnchorEra on onboarding, scheduleAnchorIfNeeded in _layout's startup effect, a response listener that calls markPromptOpened) or delete the subsystem and its column/table/keys; at minimum fix the comments in database.ts and queries.ts so they stop describing behaviour that does not exist.

### A59. [MEDIUM · design-decision] `userInterfaceStyle: "light"` is dead config on Android and breaks the Automatic theme on iOS
**Where:** `app.json:9`  ·  **Verifiers upholding:** 3/3

**What:** `userInterfaceStyle: "light"` is a no-op on Android (expo-system-ui not installed) but on iOS prebuild writes `UIUserInterfaceStyle=Light` to Info.plist, forcing `useColorScheme()` to 'light' and making ThemeContext's 'automatic' setting behave as Light. Fix requires setting the key to "automatic" explicitly — removing it is not enough, since the iOS plugin defaults to 'light' when the key is absent.

**Evidence:** app.json:9 `"userInterfaceStyle": "light"`. node_modules/@expo/prebuild-config/build/plugins/unversioned/expo-system-ui/withAndroidUserInterfaceStyle.js:16-20 only calls `addWarningAndroid('userInterfaceStyle', 'Install expo-system-ui in your project to enable this feature.')`; `ls node_modules/expo-system-ui` -> not installed. withIosUserInterfaceStyle.js:22,28-29 maps it to the Info.plist key; the locally generated ios/TinnitusTracker/Info.plist:88-89 contains `<key>UIUserInterfaceStyle</key><string>Light</string>`. app/contexts/ThemeContext.tsx:26 `const systemScheme = useColorScheme();` and :33 `setting === 'automatic' ? (systemScheme === 'dark' ? 'dark' : 'light') : setting`.

**What goes wrong:** On iOS (planned per backlog) a user with system dark mode leaves the theme on the default 'automatic' and always gets the light theme; the Appearance screen's Automatic option is silently non-functional. On Android the setting does nothing, so it misleads whoever reads app.json into thinking the system scheme is intentionally suppressed.

**Suggested fix:** Set `"userInterfaceStyle": "automatic"` (the value the ThemeContext design assumes) and keep expo-system-ui uninstalled, or remove the key.

### A60. [MEDIUM · design-decision] Guide says no direction is named when the 95% range crosses zero; the Trigger Impact panel names one at 60% probability regardless
**Where:** `app/(tabs)/trends.tsx:315`  ·  **Verifiers upholding:** 3/3

**What:** The Trigger Impact verdict line (trends.tsx:310-323) names a direction whenever max(probWorse, probBetter) >= 0.6, without checking ciLow/ciHigh, so a trigger with effect +0.6, SE 0.35 shows "61% likely to be meaningfully worse" in the worse colour while its 95% range (-0.09 to +1.29) crosses zero. The methodology guide (src/features/statistics/guide.ts:53, also es line 124 / fr line 159, and the 90% "confident" rule at line 60) promises no directional label in that case. The comment at trends.tsx:292-295 is not stale: it describes the ciLine block (296-305), which does gate on the interval; only the verdict block and the guide disagree.

**Evidence:** guide.ts:53 — 'If the span crosses zero, both improvement and worsening remain plausible, so the app does not add a directional label.' vs app/(tabs)/trends.tsx:316-323 — `prob >= 0.6 ? { color: worse ? SCALE_COLORS[4] : SCALE_COLORS[0] } : ss.corrVerdictWeak` and `{prob >= 0.6 ? t(worse ? 'stats.trigger.probWorse' : 'stats.trigger.probBetter', { percent })` with `prob = Math.max(data.probWorse, data.probBetter)` (line 275); the trends.tsx comment on lines 292-295 still describes the old rule ('The direction is only named when the whole interval sits on one side of zero'). Same sentence is carried into es/fr/de guides.

**What goes wrong:** A trigger with posterior effect +0.6 and SE 0.35: probWorse = 1 - Φ((0.5-0.6)/0.35) ≈ 0.61 >= 0.6, so the panel prints '61% likely to be meaningfully worse' in the worse colour, while ciLow = 0.6 - 1.96*0.35 ≈ -0.09 < 0, i.e. the range crosses zero. The user reading the guide expects no label in that case and is told the opposite on the Stats tab.

**Suggested fix:** Either gate the probWorse/probBetter verdict on `data.ciLow > 0` / `data.ciHigh < 0` (matching the guide and the now-stale comment at trends.tsx:292), or rewrite guide section 3 (all four locales) to describe the 60% meaningful-difference rule; also fix the comment block so it describes the code beneath it.

### A61. [MEDIUM · design-decision] The 'legacy'/'scheduled'/'self_initiated' entry source is documented as excluding pre-anchor entries from the inferential model, but no model consumer reads it
**Where:** `app/(tabs)/trends.tsx:1524`  ·  **Verifiers upholding:** 3/3

**What:** The EntrySource/anchor-era subsystem is dormant and its comments are false: `startAnchorEra` (app/db/queries.ts l.13) is never called, so every entry is written as 'legacy'; `ProcessedEntries` (app/stats/sevenDayTrend.ts l.21/36) drops `source`; and the Stats model (trends.tsx l.1524), Reports (src/features/reports/reportData.ts l.51-56) and Milestones (src/features/achievements/evaluate.ts l.109-123) all fit on every entry, contradicting the three DB-layer comments (types.ts l.37-38, queries.ts l.7-8, database.ts l.139-140) that claim legacy entries are excluded from the inferential model. Either implement the filter in one shared model-input builder (and wire a way to start the era) or remove the claim and the unused machinery.

**Evidence:** app/db/types.ts l.37-38: "'legacy' — logged before anchor check-ins existed; observation mechanism unknowable, excluded from the inferential model". app/db/queries.ts l.7-8: "Everything before it is 'legacy' and is excluded from the inferential model". app/db/database.ts l.139-140: "the inferential model reads only entries from the anchor era, while charts and streaks continue to use everything." But app/stats/sevenDayTrend.ts l.21 and l.36 build tsList without `source`; trends.tsx l.1524-1535 feeds `filterItems(processed, range)` straight into byDay with no source check; src/features/reports/reportData.ts l.51-56 and src/features/achievements/evaluate.ts l.111-116 do the same. A grep for `.source` across app/ and src/ finds no reads.

**What goes wrong:** A user with a year of self-initiated logging (bad days over-represented) then enables anchor prompts: the model keeps fitting the same mix, the stated bias-correction never happens, and the docs mislead the next developer into assuming it does. tests/stats/calibration.test.ts l.182 'Self-initiated only' case is exactly the regime the code is always in.

**Suggested fix:** Either implement the stated policy (carry `source` through ProcessedEntries and have one shared buildModelInput filter `source !== 'legacy'` when an anchor era exists), or delete the three comments and the EntrySource machinery's claim so the docs match the shipped model.

### A62. [MEDIUM · design-decision] Re-importing a backup duplicates every entry — no identity or dedup on import
**Where:** `app/db/queries.ts:340`  ·  **Verifiers upholding:** 3/3

**What:** importEntries inserts every backup entry unconditionally (no id in the export payload and no created_at/field match), so importing the same backup twice or onto a device that already holds the data duplicates every entry with no selective undo.

**Evidence:** app/db/queries.ts:331-361 inserts unconditionally; the export payload (app/my-data.tsx:141-151) carries no entry id or hash. CLAUDE.md records 'entries are appended (not replaced)' as deliberate, but no dedup exists.

**What goes wrong:** User exports, later taps Import on the same phone 'to be safe' (or imports the same file twice after the partial-import scenario above). Home list shows every entry twice, Reports 'Entries' doubles, Data summary count doubles; day-level stats are unchanged so the duplication is easy to miss and impossible to undo selectively.

**Suggested fix:** Include a stable per-entry identifier (or dedupe on `created_at` + field equality) and skip/replace matches, reporting 'N added, M already present'.

### A63. [MEDIUM · design-decision] Import always appends; restoring your own backup duplicates every entry
**Where:** `app/db/queries.ts:343`  ·  **Verifiers upholding:** 3/3

**What:** importEntries (queries.ts:343-346) inserts every backup row unconditionally and my-data.tsx:200 calls it with no dedup or replace option, so re-importing your own backup on the same device doubles every entry and all derived stats, despite the UI labelling the action "Restore entries from a backup file".

**Evidence:** queries.ts:327-331 comment and 343-346 unconditional `INSERT INTO entries (...)` for every row; my-data.tsx:200 `importEntries(parsed.entries)` with no pre-check against existing rows and no replace mode.

**What goes wrong:** User exports, later taps Import on the same device to 'restore' after a scare: entry count doubles, Calendar shows two identical rows per day, the Entries tile and coverage double, achievements like 'thirty_logged_days' are unaffected but the trigger model now weights each day twice, and Reports list every note twice.

**Suggested fix:** Offer 'Replace all' vs 'Merge' at import, and in Merge skip rows whose (created_at, intensity, note) already exist.

### A64. [MEDIUM · design-decision] 'Restore from backup' appends with no duplicate detection, so a second import doubles every entry
**Where:** `app/my-data.tsx:200`  ·  **Verifiers upholding:** 3/3

**What:** Import ('Restore entries from a backup file') appends unconditionally with no confirm step and no identity/dedupe: importEntries (app/db/queries.ts:331-361) plain-INSERTs every row, so re-importing a backup that overlaps existing entries doubles those entries in Home, counts, Stats and the trigger model.

**Evidence:** my-data.tsx:200 `const imported = importEntries(parsed.entries);` and queries.ts:331-361 insert every row unconditionally (no lookup by created_at/intensity, no entry id in the export at my-data.tsx:141-151). en.json `myData.importDataSubtitle` = "Restore entries from a backup file". CLAUDE.md records this as deliberate ("entries are appended (not replaced)"), but nothing in the UI says so and there is no confirm dialog (compare the Delete All flow at :217-238).

**What goes wrong:** User exports on day 1, keeps logging, and on day 30 imports the day-1 file to 'restore' after an accidental Delete of a few entries: all day-1 entries now exist twice. Home shows duplicate rows, 'entries logged' and Stats counts double, the trigger model sees each day's triggers twice-weighted. Same result when retrying after the partial-import failure.

**Suggested fix:** At minimum skip rows whose (created_at, intensity, note) already exist, or export a stable per-entry id and dedupe on it; and show a ConfirmDialog before import stating that entries will be added to the existing N (with the count from the file). A 'replace all' option is the more honest match for the word 'Restore'.

### A65. [MEDIUM · design-decision] Paywall is shown immediately after the disclaimer, before the user has logged anything, and the promo copy promises features that are not actually gated
**Where:** `app/onboarding/disclaimer.tsx:25`  ·  **Verifiers upholding:** 3/3

**What:** On Android, first launch pushes the dismissible RevenueCat paywall right after the disclaimer (disclaimer.tsx:25-26, paywall_enabled defaults true) before the user has logged anything; meanwhile `isSubscribed` is only read in app/(tabs)/more.tsx (banner visibility, row label) and gates no feature, so the More-tab banner's "Unlimited entries, full reports & more" (en.json:146) promises things the free tier already has. Known interim state per CLAUDE.md backlog, but should be resolved (defer paywall and/or make the banner copy truthful) before release.

**Evidence:** disclaimer.tsx:25-26 `if (isPaywallEnabled()) { router.push('/paywall'); }`; paywall.tsx:68 `options={{ displayCloseButton: true }}`. en.json:145-146 `"unlockPremium": "Unlock Premium", "unlockPremiumSubtitle": "Unlimited entries, full reports & more"`. grep `isSubscribed` outside the context hits only app/(tabs)/more.tsx:122,150,262-264 (banner visibility and row label) — no feature check anywhere.

**What goes wrong:** New user has seen three marketing slides and a legal notice, has not logged a single symptom, and is asked to subscribe. If they decline, they discover the "Unlimited entries, full reports" they were sold are already free, which undermines trust in the later Manage/Subscribe rows.

**Suggested fix:** Move the first paywall exposure to after the first saved entry (or the first time a gated feature is opened), and either decide what Premium gates before shipping the banner or change its subtitle to something true today. Keep `paywall_enabled` as the kill switch.

### A66. [MEDIUM · design-decision] The ridge penalty and posterior variance use the marginal variance of intensity, not the residual variance, so the stated prior SD of 0.35 and the '95% range' describe a model that only runs when triggers explain nothing
**Where:** `app/stats/triggerModel.ts:204`  ·  **Verifiers upholding:** 3/3

**What:** sigma2 (line 204) is the marginal variance of intensity, not residual noise, yet it is used both as the ridge scale (line 209, λ = Var(y)/0.35²) and as the posterior-variance scale (line 266). Whenever triggers explain real variance the effective prior is tighter than the 0.35 stated in src/features/statistics/guide.ts line 100 and the intervals wider than the ±1.96 SE described on line 102 — conservative in direction, but the technical guide documents a model that is only run when triggers explain nothing. Either re-estimate σ² from residuals (effective df) and refit penalty + inverse together, or amend the guide text.

**Evidence:** triggerModel.ts l.203-205: `sigma2 = Σ(v - yMean)² / (n-1)` from the raw outcome; l.209 `ridge = sigma2 / (PRIOR_SD*PRIOR_SD)`; l.266 `v = sigma2 * inv[col][col]`. With λ = Var(y)/τ², the implied prior SD is τ·sqrt(σ²_resid/Var(y)). The author's own comment l.244-251 says a future noise update 'must refit both the penalty and inverse together'. guide.ts l.100 states 'standard deviation of 0.35 intensity levels' and l.102 'The 95% range is the estimate plus or minus 1.96 model-based standard errors'. tests/stats/calibration.test.ts l.206-208 admits 'The model is often conservative (observed truth rates exceed stated probabilities)'. tests/stats/triggerModel.validation.ts l.64 only asserts the trivially-satisfied prior-width bound.

**What goes wrong:** A user whose one real trigger explains ~50% of day-to-day variance: the effect is shrunk as if the prior SD were ~0.25 and the interval is computed with a doubled noise variance, so a true +1.0-level trigger reads as roughly +0.6 with a wide bar and the 'likely to be meaningfully worse' label arrives weeks later than the data supports; the technical guide tells them a different model was used.

**Suggested fix:** After the first solve, estimate σ² from residuals with effective degrees of freedom (n − trace of the hat matrix), rebuild the ridge and re-solve once (one extra closed-form pass), or keep the current conservative choice and state in the guide that the penalty is scaled by the total variance of intensity.

### A67. [MEDIUM · design-decision] The same Switch control means "applied" on Reminders/Reports but "pending until Save" on Triggers/Sound Types; Cancel and hardware back discard silently
**Where:** `app/triggers.tsx:104`  ·  **Verifiers upholding:** 3/3

**What:** Triggers and Sound Types stage Switch toggles in local state until Save (handleSave, lines 84-97), but the header back button (line 104), the Cancel footer button (line 148) and the Android hardware back all call router.back() with no isDirty check or beforeRemove/usePreventRemove guard, silently discarding pending toggles. Reminders (reminders.tsx:56-58 updateReminder on toggle) and Reports (reports.tsx:99) apply the same Switch control instantly, so a user has no cue which rule applies. The split itself is documented as intentional in CLAUDE.md; the missing unsaved-changes guard is the actionable gap.

**Evidence:** triggers.tsx:132-137 `<Switch value={row.active} onValueChange={() => toggleActive(row.id)} .../>` (local state), :84-97 handleSave writes DB, :148-161 footer with Cancel = `router.back()` and no dirty-check; sound-types.tsx:132 identical. reminders.tsx:115-120 `<Switch value={defaultReminder.enabled === 1} onValueChange={() => toggleEnabled(defaultReminder)}` → :56-65 `updateReminder(...)` immediately. reports.tsx:99 `<Switch value={includeNotes} onValueChange={setIncludeNotes} ... />` immediate.

**What goes wrong:** User disables three triggers, taps the system back gesture (or the header back button) expecting them saved like on Reminders: all changes are lost with no prompt. Conversely a user on Reminders looks for a Save button after toggling.

**Suggested fix:** Pick one rule: make Switch-based lists instant-apply (keep Save/Cancel only for the radio-style choice screens), or keep deferral but add an "Unsaved changes" ConfirmDialog on back/Cancel when `isDirty`.

### A68. [MEDIUM · design-decision] Dates follow the device locale while all text (and the PDF) follow the app language, producing mixed-language screens
**Where:** `app/utils/datetime.ts:3`  ·  **Verifiers upholding:** 3/3

**What:** All in-app date/month/weekday formatting uses the device locale (`undefined`, per the datetime.ts:3-5 design note, and at calendar.tsx:60/202, entry/new.tsx:357, entry/[id].tsx:321, (tabs)/index.tsx:52, trends.tsx:52, sevenDayTrend.ts:102, my-data.tsx:40), while adjacent i18n labels (calendar.tsx:195 dayLetters, trends.tsx:1497 dowLabels), chip collation (builtInNames.ts:55 vs trends.tsx:519) and the PDF (reports.tsx:44 → reportHtml.ts:12) use the app language chosen via settings.language; when the two differ, one screen mixes two languages and the PDF disagrees with the app.

**Evidence:** app/utils/datetime.ts:3-5 comment "Display formatting always uses the device's locale (undefined = inherit OS Region/Language settings)". Device-locale sites: app/(tabs)/calendar.tsx:202 `currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })` and :60-62; app/entry/new.tsx:357; app/(tabs)/index.tsx:52; app/(tabs)/trends.tsx:52; app/stats/sevenDayTrend.ts:102; app/my-data.tsx:40. App-language sites on the same screens: app/(tabs)/calendar.tsx:195 `t('calendar.dayLetters', { returnObjects: true })`, app/(tabs)/trends.tsx:1497 `t('stats.dowLabels', ...)`, and the PDF: app/reports.tsx:44 `locale: i18n.resolvedLanguage` → src/features/reports/reportHtml.ts:12 `new Intl.DateTimeFormat(locale, ...)`. Same split for collation: app/(tabs)/trends.tsx:519 sorts chips with `localeCompare` (device) while app/i18n/builtInNames.ts:55 sorts with the app language.

**What goes wrong:** Device en-US, app language Deutsch: Calendar shows "October 2026" above the German day letters "M D M D F S S"; the entry form shows "Wie fühlst du dich?" over "Monday, October 5"; Stats' by-day-of-week chart is German while the trend axis reads "Oct 5"; the exported PDF for the same data is fully German.

**Suggested fix:** Pick one rule and centralise it in datetime.ts; the consistent choice is the app language (`i18n.resolvedLanguage`) for names/order, keeping `prefersHour12()` and `Localization.getCalendars()` for the 12/24-hour and first-day preferences, so screens and the PDF agree.

### A69. [MEDIUM · i18n] Dates, month names and chart axis labels follow the device locale while all other text follows the in-app Language setting, producing mixed-language screens
**Where:** `app/(tabs)/calendar.tsx:202`  ·  **Verifiers upholding:** 3/3

**What:** In-app date/month/weekday formatting (calendar.tsx:59-63,202; entry/new.tsx:357; entry/[id].tsx:321; (tabs)/index.tsx:52; trends.tsx:52; sevenDayTrend.ts:102; my-data.tsx:40; datetime.ts:83) uses the device locale (`undefined`), while adjacent copy such as `calendar.dayLetters` (:195) follows the user-chosen app language, and the Reports feature (reports.tsx:44 → reportHtml.ts:12) already formats with `i18n.resolvedLanguage`. When device and app language differ the Calendar shows e.g. a German weekday row under an English month title, and the Language screen promises "the app's display language" without scoping it to copy only.

**Evidence:** app/utils/datetime.ts:3-5 "Display formatting always uses the device's locale (undefined = inherit OS Region/Language settings)". app/contexts/LanguageContext.tsx:81-91 resolves and applies a user-chosen language via `i18n.changeLanguage(resolvedLanguage)`. calendar.tsx:202 `currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })`, :59-63 formatDetailHeader same, while :195 `t('calendar.dayLetters', ...)` is translated. Also new.tsx:357, [id].tsx:321, index.tsx:52-54, trends.tsx:52, sevenDayTrend.ts:102 (`new Intl.DateTimeFormat(undefined, LABEL_OPTIONS[style])`), reminders.tsx:31, my-data.tsx:40.

**What goes wrong:** Device en-US, app Language = Deutsch: Calendar header "October 2026" above a German "M D M D F S S" row, detail header "Monday, October 5", Home rows "Mon, Oct 5 · 9:00 AM" under German card titles.

**Suggested fix:** Format with `i18n.resolvedLanguage` for date/month/weekday names (keep hour12 from expo-localization, which is a device preference), or explicitly scope the Language setting to copy only and say so on the Language screen.

### A70. [MEDIUM · i18n] 24 locales fall back to English for 49 keys outside the documented Learn/Reports/Milestones exception
**Where:** `app/(tabs)/trends.tsx:539`  ·  **Verifiers upholding:** 3/3

**What:** 20 locales (all non-en/de/es/fr except et/id/lt/lv) lack the entire stats.trigger.* namespace (38 keys) plus stats.intensityTrendRollingDesc, 5 more.* rows, 3 settings.* keys and 2 anchor.* keys — 49 keys outside the documented Learn/Reports/Milestones exception; et/id/lt/lv lack 10 of them. With fallbackLng 'en' (app/i18n/index.ts:71) the Trigger Impact card, its info sheet, and several More/Settings rows render in English inside otherwise-translated screens.

**Evidence:** Parity script: 24 locales miss 135-174 of 559 en keys; for sk.json the non-exempt missing groups are stats: 39 (e.g. stats.trigger.title/subtitle/view/info/sortBy/...), more: 5 (more.statisticsGuide), settings: 3, anchor: 2 — 49 keys. Usages: app/(tabs)/trends.tsx:539 `<Text style={ss.cardTitle}>{t('stats.trigger.title')}</Text>`, :572; app/(tabs)/more.tsx:203-204 `t('more.statisticsGuide')`. CLAUDE.md (session 2026-10-04): 'Copy added to en/de/es/fr only (the other 24 locales fall back to English, same as the rest of Learn/Reports/Milestones)'. app/i18n/index.ts:40-68 registers all 28 locales so the fallback is silent.

**What goes wrong:** A Slovak, Polish or Italian user sees the Stats tab with every card localized except Trigger Impact (title, sort chips, info sheet, evidence wording) in English, plus English rows on the More tab; the app looks half-translated with no indication why.

**Suggested fix:** Either machine-translate the 49 non-exempt keys using the same practice as the rest, or explicitly whitelist the exempt namespaces in the parity script so the exception is encoded rather than tribal knowledge; update CLAUDE.md to match reality.

### A71. [MEDIUM · i18n] Delete-entry confirmation dialog has a hardcoded English "Cancel" button
**Where:** `app/components/ConfirmDialog.tsx:58`  ·  **Verifiers upholding:** 3/3

**What:** ConfirmDialog hardcodes the English "Cancel" button label (line 58) and never uses i18n; all five callers pass a translated confirmLabel so the 'Delete' default (line 23) is unused, but the Cancel button is untranslated on every destructive-confirmation dialog in non-English locales. Fix: use t('common.cancel') (as AddItemModal.tsx:90 already does) and default confirmLabel to t('common.delete').

**Evidence:** app/components/ConfirmDialog.tsx:58 `<Text style={ss.btnCancelText}>Cancel</Text>`; line 23 `confirmLabel = 'Delete'`; the component never imports useTranslation. It is used from app/entry/[id].tsx:503-510 (and my-data, triggers, reminders, sound-types). `common.cancel` exists in en.json and AddItemModal.tsx:90 already uses it.

**What goes wrong:** German user taps the trash icon on an entry: title/message/"Löschen" are translated but the left button reads "Cancel".

**Suggested fix:** Use `t('common.cancel')` for the cancel button and `t('common.delete')` as the default confirm label inside ConfirmDialog.

### A72. [MEDIUM · i18n] 24 of 27 translated locales are missing a quarter to a third of the UI strings, and shared dialogs hard-code English
**Where:** `app/components/ConfirmDialog.tsx:58`  ·  **Verifiers upholding:** 3/3

**What:** 24 of 27 non-English locales lack the `reports`, `achievements`, `learn`, `localSupport`, `anchor` namespaces and parts of `stats`/`settings` (174 or 135 missing keys; de/es/fr miss 5), yet app/i18n/index.ts:32-35 advertises all 28 in the language picker, so Trigger Impact, Reports, Milestones, Learn and Local Support fall back to English. ConfirmDialog.tsx:58 hard-codes "Cancel" (reached by all 5 callers), and StatusDialog's English "OK" default (StatusDialog.tsx:25) is reached from app/app-lock.tsx:103 which omits `buttonLabel`. The `confirmLabel='Delete'` default is never reached and PlaceholderScreen is unused.

**Evidence:** python key-parity run: `bg: missing=174`, `pl: missing=174`, `et: missing=135`, `de: missing=5 ['stats.intensityTrendRollingDesc','reports.pdf.notEnoughImpact','settings.appLockUnavailableTitle',...]`. ConfirmDialog.tsx:23 `confirmLabel = 'Delete'`, :58 `<Text style={ss.btnCancelText}>Cancel</Text>`; StatusDialog.tsx:25 `buttonLabel = 'OK'`; PlaceholderScreen.tsx:13 'Content coming soon.'. LanguageContext.tsx:12-41 lists all 28 as selectable.

**What goes wrong:** A Polish user selects Polski: Home and the entry form are Polish, but the Stats tab's Trigger Impact card, the Reports screen, Milestones and the methodology guide are entirely English; every delete confirmation shows an English 'Cancel' next to a Polish 'Delete'.

**Suggested fix:** Use `t('common.cancel')` / `t('common.ok')` / `t('common.delete')` inside the dialogs; add a `scripts/check-locales.ts` parity check to the (new) test script; either finish the 24 locales or ship the picker with only the 4 fully-covered languages and fall back to English elsewhere.

### A73. [MEDIUM · i18n] Shared dialogs hard-code "Cancel", "Delete" and "OK" instead of using the existing common.* keys
**Where:** `app/components/ConfirmDialog.tsx:58`  ·  **Verifiers upholding:** 3/3

**What:** ConfirmDialog hard-codes the "Cancel" button label (line 58) so all 5 destructive-action dialogs show an English "Cancel" beside translated title/confirm text in every non-English locale; StatusDialog's default buttonLabel 'OK' (StatusDialog.tsx:25) leaks into app/app-lock.tsx:103 (only caller omitting the prop), wrong in es/hr/lt/lv/sl/sr/tr/uk; app/my-data.tsx:168 share-sheet title is untranslated. The 'Delete' default at ConfirmDialog.tsx:23 is never reached (all callers pass confirmLabel).

**Evidence:** ConfirmDialog.tsx:58 `<Text style={ss.btnCancelText}>Cancel</Text>` and :23 `confirmLabel = 'Delete'`; StatusDialog.tsx:25 `buttonLabel = 'OK'`, used without a label at app/app-lock.tsx:103-109. app/my-data.tsx:168 `dialogTitle: 'Save Tinnitus Data'`. The keys exist: en.json:3-10 `common.cancel/ok/delete`, de.json:3 `"cancel": "Abbrechen"`.

**What goes wrong:** German UI, user taps the trash icon on an entry (app/entry/[id].tsx:503-510): the dialog title and body are German, the two buttons read "Cancel" / "Löschen". The App Lock "unavailable" dialog shows an English "OK" button.

**Suggested fix:** Call useTranslation inside ConfirmDialog/StatusDialog and default to t('common.cancel'), t('common.delete'), t('common.ok'); move the share-sheet title to a myData key.

### A74. [MEDIUM · i18n] Hard-coded "Cancel" (and default "OK") in shared dialogs used by every destructive action
**Where:** `app/components/ConfirmDialog.tsx:58`  ·  **Verifiers upholding:** 3/3

**What:** ConfirmDialog hard-codes the "Cancel" button label (no useTranslation) although common.cancel exists in all locales; StatusDialog's literal 'OK' default leaks via app/app-lock.tsx:103-108, the only caller not passing t('common.ok'). The 'Delete' default on line 23 is dead.

**Evidence:** app/components/ConfirmDialog.tsx:58 `<Text style={ss.btnCancelText}>Cancel</Text>` (file has no `useTranslation`); callers: app/my-data.tsx:307, app/triggers.tsx:163, app/reminders.tsx:180, app/sound-types.tsx:163, app/entry/[id].tsx:503. en.json:3 `"cancel": "Cancel"`. app/components/StatusDialog.tsx:25 `buttonLabel = 'OK'`; app/app-lock.tsx:103-108 is the one of 7 callers that omits `buttonLabel`. Line 23's `confirmLabel = 'Delete'` default is dead (every caller passes it).

**What goes wrong:** Russian user deletes an entry: dialog title/body in Russian, buttons read "Cancel" | "Удалить". Serbian user without a device lock taps Save on App Lock: the dialog button reads "OK" where sr.json has "U redu".

**Suggested fix:** Use `useTranslation` in ConfirmDialog (`t('common.cancel')`), pass `t('common.ok')` in app-lock.tsx, and drop or translate the `'Delete'` default.

### A75. [MEDIUM · i18n] Intensity level names under the scale icons are hardcoded English
**Where:** `app/entry/new.tsx:91`  ·  **Verifiers upholding:** 3/3

**What:** Intensity scale labels on the add (app/entry/new.tsx:91) and edit (app/entry/[id].tsx:85) forms are the hardcoded English INTENSITY_LABELS from app/constants/theme.ts:2, not translated, although a localized equivalent already exists at reports.pdf.levels in every locale file.

**Evidence:** app/entry/new.tsx:91 and app/entry/[id].tsx:85 render `{INTENSITY_LABELS[i]}`; app/constants/theme.ts:2 defines `INTENSITY_LABELS = ['None', 'Faint', 'Mild', 'Moderate', 'Loud', 'Severe']`. A translated array already exists at `reports.pdf.levels` (en.json:269, de.json:245 = ["Keine","Sehr schwach",…]).

**What goes wrong:** App language set to German: the PDF report says "Sehr schwach" but the add/edit form shows "FAINT" under the second icon. Same for all 27 non-English locales.

**Suggested fix:** Add an `entryForm.intensityLevels` array (or reuse `reports.pdf.levels`) and read it via `t(..., { returnObjects: true })` in ScaleSelector; keep INTENSITY_LABELS only as the English fallback.

### A76. [MEDIUM · i18n] Plural forms stop at _one/_other and the runtime has no Intl.PluralRules, so every language gets English plural rules
**Where:** `app/i18n/index.ts:39`  ·  **Verifiers upholding:** 3/3

**What:** i18n init (app/i18n/index.ts:39-73) imports no Intl.PluralRules polyfill and Hermes ships without Intl.PluralRules, so i18next 26.3.6 silently falls back to its English `count === 1 ? 'one' : 'other'` dummyRule for every language; combined with all 28 locale files defining only `_one`/`_other` (+ one `_zero`) for the six pluralised keys, Slavic/Baltic/Romanian users get grammatically wrong plural strings (e.g. ru.json:269 "2 записей добавлено", cs "3 aktivních", pl "22 wpisów") in My Data, Profile and Learn.

**Evidence:** Per-locale plural-suffix scan: every file has exactly {one, other} (+ `myData.entriesLogged_zero`), never `_few`/`_many`/`_two`; e.g. ru.json:269 `"entriesLogged_other": "{{count}} записей добавлено"`, pl.json:269 `"{{count}} wpisów zapisanych"`, cs.json:269 `"{{count}} záznamů zaznamenáno"`. Node ICU shows which integer counts need the missing forms: ru/uk `few`=2-4,22-24 and `many`=0,5-20,25-30; pl same plus 21; cs/sk/hr/sr `few`=2-4; sl `two`=2,`few`=3-4; ro `few`=0,2-19; lt `few`=2-9,22-29; lv `zero`=0,10-20. Runtime: `strings` on ios/Pods/hermes-engine/.../hermesvm.xcframework/ios-arm64/hermesvm.framework/hermesvm finds DateTimeFormat(12) NumberFormat(13) Collator(10) getCanonicalLocales(1) but PluralRules 0, DisplayNames 0; package.json has no intl-pluralrules polyfill and app/i18n/index.ts:39-73 sets no `compatibilityJSON`. i18next 26.3.6 (node_modules/i18next/dist/cjs/i18next.js:1063-1071): `rule = new Intl.PluralRules(...)` throws → `if (!code.match(/-|_/)) return dummyRule;` where :1035 `dummyRule = { select: count => count === 1 ? 'one' : 'other' }`. Call sites: app/my-data.tsx:254 `t('myData.entriesLogged', { count })`, app/profile.tsx:115 `t('personalization.activeCount', { count })`, app/learn/index.tsx:67 `t('learn.minutes', { count })`.

**What goes wrong:** Russian user with 2 entries opens My Data → header reads "2 записей добавлено" (genitive plural; correct is "2 записи"); Czech Profile with 3 active sound types → "3 aktivních" instead of "3 aktivní"; Polish with 22 entries → "22 wpisów" instead of "22 wpisy". If an Intl.PluralRules polyfill is later added without adding the forms, the resolver (i18next.js:830-865) tries `key_few`, then the bare key, then moves to the `en` fallback where the suffix is recomputed as `_other` — a Russian user with 5 entries would then see the English "5 entries logged".

**Suggested fix:** Do both halves: (1) import an Intl.PluralRules polyfill (e.g. `@formatjs/intl-pluralrules` + locale data for the 28 languages) before `i18n.init`; (2) add `_few`/`_many` (ru, uk, pl, cs, sk, hr, sr, lt), `_two`+`_few` (sl), `_few` (ro) and `_zero` (lv) variants for `myData.entriesLogged`, `myData.daysAgo`, `myData.importCompleteMessage`, `myData.dataDeletedMessage`, `personalization.activeCount`, `learn.minutes`. Also add a bare base key for each (the same-language safety net `stats.trigger.dayCount` already relies on), and a script that asserts every plural key has all CLDR categories per locale.

### A77. [MEDIUM · i18n] de/es/fr are missing five in-use keys; English leaks into fully translated locales
**Where:** `app/i18n/locales/de.json:568`  ·  **Verifiers upholding:** 3/3

**What:** de/es/fr each lack five keys the code calls (settings.on, settings.appLockUnavailableTitle/Message, stats.intensityTrendRollingDesc, reports.pdf.notEnoughImpact); fallbackLng 'en' masks it so e.g. the App Lock row shows a translated "Off" but an English "On", and no parity check or test script exists to catch future drift.

**Evidence:** Key-parity script over app/i18n/locales: de, es, fr each miss exactly ['stats.intensityTrendRollingDesc', 'reports.pdf.notEnoughImpact', 'settings.appLockUnavailableTitle', 'settings.appLockUnavailableMessage', 'settings.on'] (defined in en.json:52, 283, 633, 634, 636; de.json's `"settings": {` block starts at line 568 without them). Usages: app/app-lock.tsx:76 `t(value ? 'settings.on' : 'settings.off')`, :106 `t('settings.appLockUnavailableTitle')`; app/settings.tsx:164; app/(tabs)/trends.tsx:1703 `t('stats.intensityTrendRollingDesc')`; src/features/reports/reportHtml.ts:104 `t('reports.pdf.notEnoughImpact')`. app/i18n/index.ts:71 `fallbackLng: 'en'`. tests/ contains no locale check; CLAUDE.md says parity checks 'were run' ad hoc.

**What goes wrong:** A German user opens Settings: the App Lock row reads 'On' next to German labels; with no device credential set, the dialog title/body appear in English; the rolling-average caption on Stats and one line of the exported PDF are English. Every future key added to en.json can repeat this silently.

**Suggested fix:** Add the missing five translations, and commit the parity check (a ~15-line node/tsx script comparing flattened keys of every locale against en.json) to tests/ and the `test` script so a missing key fails CI.

### A78. [MEDIUM · i18n] Support-directory country names are always English because Intl.DisplayNames is unavailable on Hermes
**Where:** `app/support-directory.tsx:25`  ·  **Verifiers upholding:** 3/3

**What:** `localizedCountry` depends on `Intl.DisplayNames`, which Hermes does not implement and the app does not polyfill, so the support-directory country picker always shows the hard-coded English `countryFallback` names in non-English UIs, sorts them by English (line 57), and the country search filter (line 70) only matches English spellings.

**Evidence:** app/support-directory.tsx:22-30: `const DisplayNames = (Intl as any).DisplayNames; return DisplayNames ? new DisplayNames([locale], { type: 'region' }).of(item.countryCode) ?? item.countryFallback : item.countryFallback;`. `strings` on the shipped hermesvm binary: `DisplayNames` 0 occurrences (DateTimeFormat 12, NumberFormat 13). src/features/support/organizations.ts:9 `countryFallback: string;`, :52 `countryFallback: 'Germany'`. Sort at support-directory.tsx:57 `a.country.localeCompare(b.country, locale)` operates on the English strings.

**What goes wrong:** German user opens More > Find local support: the picker lists "Germany", "Austria", "Switzerland" under German headings, ordered by English alphabet.

**Suggested fix:** Either add `@formatjs/intl-displaynames` (+ locale data) alongside the PluralRules polyfill, or ship translated country names in the locale files (`countries.<ISO>`) and drop `countryFallback`.

### A79. [MEDIUM · i18n] German copy calls Trigger Impact three different names: 'Auslöserwirkung' (Learn), 'Trigger-Einfluss' (guide) and 'Auslöser-Einfluss' (Stats card, Milestones)
**Where:** `src/features/learn/content.ts:247`  ·  **Verifiers upholding:** 3/3

**What:** German (and, to a lesser degree, Spanish) hard-coded Learn/guide copy names the Trigger Impact feature differently from the label the Stats card actually renders via t('stats.trigger.title'): content.ts:247 "Auslöserwirkung", guide.ts:184/199 "Trigger-Einfluss", de.json:102/223 "Auslöser-Einfluss"; Spanish content.ts:115 "Impacto de los desencadenantes" vs es.json:102 "Impacto de desencadenantes". The article's "see the X section" cross-reference therefore points at a name that appears nowhere in the UI.

**Evidence:** content.ts:247 — 'Der Bereich Auslöserwirkung berücksichtigt erfasste Auslöser…'; src/features/statistics/guide.ts:184 — 'was Trigger-Einfluss berechnet'; app/i18n/locales/de.json:102 — "title": "Auslöser-Einfluss" and de.json:223 pattern_found body '„Auslöser-Einfluss“'. Spanish has a smaller mismatch: content.ts:115 'Impacto de los desencadenantes' vs es.json stats.trigger.title 'Impacto de desencadenantes'.

**What goes wrong:** A German user reads 'Der Bereich Auslöserwirkung…' in the Tracking-patterns article, goes to the Stats tab and finds a card titled 'Auslöser-Einfluss', and a guide that talks about 'Trigger-Einfluss' — three names, no section called Auslöserwirkung anywhere.

**Suggested fix:** Pick one German term (the de.json stats.trigger.title is the one users see on the card) and use it in content.ts and guide.ts; same for the Spanish definite-article variant. Consider sourcing feature names from the locale JSON (e.g. t('stats.trigger.title')) in the articles via a placeholder instead of hard-coding them in three places.

### A80. [MEDIUM · i18n] PDF prints built-in trigger names in English and numbers with a '.' decimal regardless of report language
**Where:** `src/features/reports/reportHtml.ts:92`  ·  **Verifiers upholding:** 3/3

**What:** The doctor-report PDF prints built-in trigger names raw from the DB (lines 92 and 97: `escapeHtml(item.name)`), skipping `triggerLabel` from app/i18n/builtInNames.ts that every in-app surface uses, so a non-English report has translated headings over English trigger rows. Decimal numbers use `toFixed(1)` (lines 17, 83) while dates are locale-formatted (line 12); this is consistent with the in-app Stats tab (app/(tabs)/trends.tsx:176/181/1625), so it is an app-wide polish item rather than a PDF-specific bug.

**Evidence:** src/features/reports/reportHtml.ts:92 `escapeHtml(item.name)` and :97 `escapeHtml(item.name)` use the raw name; `triggerLabel`/`soundTypeLabel` are used in app/triggers.tsx, app/sound-types.tsx, app/entry/new.tsx, app/entry/[id].tsx, app/(tabs)/trends.tsx and app/components/ExpandableEntryRow.tsx but not here (grep). Lines 83 `data.average?.toFixed(1)` and 16-18 `signed()` → `Math.abs(value).toFixed(1)` hard-code '.'; `date()` on line 10-14 is locale-aware, so the document mixes conventions.

**What goes wrong:** A German user shares the PDF with their HNO-Arzt: headings read 'Häufig protokollierte Auslöser' but rows read 'Poor sleep', 'Jaw tension (TMJ)', 'Weather / pressure change', and the average is '3.2' where German expects '3,2'.

**Suggested fix:** Pass a label function (or pre-translate names in `reports.tsx` via `triggerLabel(t, name)`) into `buildReportHtml`, and format numbers with `Intl.NumberFormat(locale, { maximumFractionDigits: 1 })`.

### A81. [MEDIUM · i18n] PDF report prints built-in trigger names in English regardless of app language
**Where:** `src/features/reports/reportHtml.ts:92`  ·  **Verifiers upholding:** 3/3

**What:** PDF report tables at reportHtml.ts:92 and :97 render raw DB trigger names (from reportData.ts:67, sorted by English name at :81) instead of `triggerLabel(t, name)`, so built-in triggers appear in English under localized headings for non-English users.

**Evidence:** src/features/reports/reportHtml.ts:92 `...map(item => `<tr><td>${escapeHtml(item.name)}</td>...` and :97 `return `<tr><td>${escapeHtml(item.name)}</td>...`; names come from src/features/reports/reportData.ts:67 `entry.triggers.map(trigger => trigger.name)` and are sorted at :81 with `a.name.localeCompare(b.name)`. `triggerLabel` (app/i18n/builtInNames.ts:47-50) is used at every in-app site (app/(tabs)/trends.tsx:648,701; app/components/ExpandableEntryRow.tsx:204; entry forms) but is not imported anywhere under src/features/reports.

**What goes wrong:** French user creates a summary PDF: the table headed "Déclencheur / Jours présents" lists "Poor sleep", "Loud noise", "Jaw tension (TMJ)".

**Suggested fix:** Pass names through `triggerLabel(t, item.name)` in reportHtml (and sort by the label) — custom user-entered names are returned unchanged by the helper.

### A82. [MEDIUM · i18n] The methodology guide describes features the shipped model no longer has: a collinearity flag and a 90% display threshold
**Where:** `src/features/statistics/guide.ts:61`  ·  **Verifiers upholding:** 3/3

**What:** The statistics guide (en l.61/l.68, es l.125-126, fr l.160-161, de l.195-196) and en.json stats.trigger.info SORTING describe a 90% display threshold, an overlap/collinearity "flag", and magnitude-based Effect sorting; the shipped code shows percentage verdicts from prob >= 0.6 (trends.tsx l.314-324), has no overlap flag (TriggerEstimate l.32-55, no renderer), and sorts Effect by signed value (trends.tsx l.475-483).

**Evidence:** guide.ts l.68: "The app flags these triggers instead of presenting their individual estimates as settled." (repeated in es l.126, fr l.161, de l.196). TriggerEstimate (app/stats/triggerModel.ts l.32-55) has no overlap/collinearity field and CorrelationPanel (trends.tsx l.266-394) renders no such warning; CLAUDE.md session 2026-10-04 records the removal. guide.ts l.61: "A result is shown as confident when the model gives at least a 90% probability" — trends.tsx l.316-323 prints `{{percent}}% likely to be meaningfully worse` whenever `prob >= 0.6`; 0.9 is only used for `robustness` (triggerModel.ts l.289-290). Also en.json stats.trigger.info 'SORTING' says Effect "ranks by the size of the difference" while trends.tsx l.475-483 sorts by signed value (a −1.0 relief sorts below +0.0).

**What goes wrong:** A user sees "65% likely to be meaningfully worse" on a trigger, opens 'Read how these statistics work' and reads that claims only appear at 90% and that overlapping triggers are flagged; neither matches the screen, undermining the credibility the guide exists to build.

**Suggested fix:** Rewrite guide section 4 to describe the actual states (percentage shown at >=60%, 'Probably worse/better by less than half a level', 'No clear direction yet', and the 'small effect' robustness note), and either restore an overlap indicator or remove section 5's 'flags' sentence in all four languages; change the SORTING wording to 'from most worsening to most improving'.

### A83. [MEDIUM · performance] Thirteen useMemos depend on i18n label arrays that are new objects on every render, so they recompute on every tap/toggle regardless of the fingerprint optimisation
**Where:** `app/(tabs)/trends.tsx:1497`  ·  **Verifiers upholding:** 3/3

**What:** The five i18n label arrays (l.1497-1501) are rebuilt on every StatsScreen render (i18next returnObjects allocates a fresh array; distressLabels is a literal), so the 13 useMemos that list them as deps (l.1547-1562: dowBuckets, four dow enum buckets, four enum period datasets, four smoothed enum trends) recompute on every local state change — trigger-row tap, bars/line toggle, day-of-week category switch — bypassing the fingerprint optimisation. Fix: wrap each label array in useMemo keyed on t / i18n.language.

**Evidence:** trends.tsx l.1497-1501: `const dowLabels = t('stats.dowLabels', { returnObjects: true }) as string[];` (same for pitch/duration/location) and `const distressLabels = [t(...), t(...), t(...)]`. i18next builds a new container per call: node_modules/i18next/dist/esm/i18next.js l.628 `const copy = resTypeIsArray ? [] : {};` ... l.655 `res = copy;`. Those arrays are deps of dowBuckets (l.1547), dowPitch/dowDuration/dowLocation/dowDistress (l.1549-1552), pitchData..distressData (l.1553-1556) and pitchTrend..distressTrend (l.1559-1562). computeDayOfWeekBuckets constructs a Date per entry (l.784) and smoothStackedTrend runs four rolling passes.

**What goes wrong:** Tapping a trigger row (setOpenTriggers l.1748), toggling bars/line (l.1689), or switching the day-of-week category (l.1762) re-renders StatsScreen; all 13 memos recompute (1000 Date constructions, 4x enum bucketing, 4x smoothing) on each tap, which is exactly the work the l.1476-1481 comment says the fingerprint was added to avoid.

**Suggested fix:** Memoise the label arrays on the i18n language: `const dowLabels = useMemo(() => t('stats.dowLabels', { returnObjects: true }) as string[], [t])` (and the same for the others, including distressLabels), or compute buckets with stable keys and attach labels at render time.

### A84. [MEDIUM · security] DB-pull helper drops a personal health database into the repo root with no .gitignore rule
**Where:** `pulldb.sh:5`  ·  **Verifiers upholding:** 3/3

**What:** pulldb.sh pulls the device's tinnitus.db (health entries, notes, user name) into the repo root via `adb pull /sdcard/tinnitus.db` with no destination path, and .gitignore has no *.db/*.sqlite rule, so a `git add -A` after running it would commit personal data; the script also still targets Expo Go's package (host.exp.exponent) instead of tech.kappsa.tinnitustracker and has an indented, non-functional shebang.

**Evidence:** pulldb.sh:4 `adb shell cp /data/user/0/host.exp.exponent/files/SQLite/tinnitus.db /sdcard/tinnitus.db` (host.exp.exponent is Expo Go; app.json:26 package is tech.kappsa.tinnitustracker and expo-dev-client has been used since f8ba705 2026-05-21); :5 `adb pull /sdcard/tinnitus.db` writes to cwd. `grep -n 'db\|sqlite' .gitignore` -> no match; `git ls-files | grep -iE '\.(db|sqlite)'` -> none tracked yet.

**What goes wrong:** Developer fixes the package path, runs ./pulldb.sh, then `git add -A` for an unrelated change: tinnitus.db (real symptom entries, notes, name) is committed and pushed to the GitHub repo.

**Suggested fix:** Add `*.db`, `*.db-journal`, `*.sqlite*` to .gitignore; make the script pull into the scratch/tmp dir and use the real package id (or `adb exec-out run-as tech.kappsa.tinnitustracker cat ...` which does not need adb root).

### A85. [MEDIUM · testing] Highest-risk logic (schema migration/backfill, local-day date math, import/export) has zero tests
**Where:** `app/db/database.ts:117`  ·  **Verifiers upholding:** 3/3

**What:** No tests (and no test runner/script in package.json) cover the schema migration/backfill (`ensureColumn` :107, `backfillTimezoneAndLocalDate` :117), the local-day date math in app/utils/datetime.ts (`computeLocalDate` :69, `formatDateKey` :62) that Calendar (calendar.tsx:183), Stats (sevenDayTrend.ts:35) and the day-range query (queries.ts:226) key on, the backup round-trip (`getAllEntriesWithRelations` :299 / `importEntries` :331), or achievements/sync.ts; the three existing tests/ files only import triggerModel, evaluate, learn content, reports and support data.

**Evidence:** tests/ contains only features.validation.ts, stats/calibration.test.ts, stats/triggerModel.validation.ts. Untested: app/db/database.ts:107-112 `ensureColumn` (PRAGMA table_info + ALTER TABLE) and :116+ `backfillTimezoneAndLocalDate` whose own comment says 'Best-effort only: we don't know what timezone the user was actually in'; app/utils/datetime.ts and app/utils/calendarNav.ts (local-day bucketing that Calendar/Stats key on; no test imports them); queries.ts `importEntries`/`getAllEntriesWithRelations` (backup round-trip); src/features/achievements/sync.ts.

**What goes wrong:** A refactor of local_date assignment shifts entries logged between 23:00 and 01:00 across a DST change to the wrong calendar day; Calendar, streaks and the 7-day trend all move, and nothing fails. An import-format tweak that drops trigger links on restore likewise ships silently.

**Suggested fix:** Add pure tests for datetime/calendarNav (fixed TZ via `TZ=` env in the script), an in-memory sqlite migration test (create the v1 schema, run initDatabase, assert columns + backfilled local_date), and an export->import round-trip equality test.

### A86. [MEDIUM · testing] fitTemporalProfile and the suspectReverse heuristic have no test; the existing test scripts are not runnable from the repo and never cover the shipped aggregation
**Where:** `app/stats/triggerModel.ts:326`  ·  **Verifiers upholding:** 3/3

**What:** fitTemporalProfile (lag/lead columns l.353-358, dayAfter/dayBefore mapping l.363-364, suspectReverse threshold l.379-382) drives the Stats "Day before"/"Day after" tiles and the confounding warning in trends.tsx but has zero test coverage; the comment's "calibrated on simulation" has no corresponding simulation in tests/. The two existing test scripts document `npx tsx` but tsx is not a devDependency, there is no `test` npm script and no CI, and the day-level model-input aggregation is trapped inside a useMemo in trends.tsx (l.1523-1539) so it cannot be tested either.

**Evidence:** `grep -rn fitTemporalProfile tests` returns nothing. triggerModel.ts l.370-373 claims 'Calibrated on simulation: ... same +0.84 / lead +0.38' but no simulation exists in tests/. tests/stats/calibration.test.ts l.10 and tests/stats/triggerModel.validation.ts l.2 say 'Run: npx tsx ...'; package.json has no `tsx` in devDependencies, no `test` script, and there is no .github directory. The model input aggregation lives in trends.tsx l.1523-1539 inside a React component so cannot be imported by a test.

**What goes wrong:** A refactor of the `adjacent` check (l.348-349) or the lag/lead column construction (l.353-358) that swaps lag and lead would make the 'Day before' tile show the carry-over figure and the warning fire on genuine carry-over; nothing would catch it, and a developer running the documented command gets 'tsx not found' until npx downloads it.

**Suggested fix:** Add tsx (or vitest) as a devDependency with `"test": "tsx tests/stats/triggerModel.validation.ts && tsx tests/stats/calibration.test.ts"`; add a test that builds a world with a known lagged effect and a known confounded one and asserts dayAfter/dayBefore signs and suspectReverse; move the aggregation out of the screen so it can be covered too.

### A87. [MEDIUM · testing] Clinical review package omits the 'Medicines and tinnitus' article, yet claims all customer-facing clinical statements were checked
**Where:** `docs/release-checklists/learn-clinical-review-package.md:23`  ·  **Verifiers upholding:** 3/3

**What:** The clinical review package claims all customer-facing clinical statements were checked on 2026-08-24 and lists six articles, but src/features/learn/content.ts (line 68, added 2026-10-04 in 9f0b75c) ships a seventh "Medicines and tinnitus" article with specific drug-class and dose/reversibility claims that has no row, no claims-to-review, no source check and no risk rating; the header's "Review candidate" branch is also stale after the merge. A sign-off of the table as written, followed by removal of the in-app "Clinical review required" marker (en.json:299) per lines 87-89, would ship the unreviewed medicines article under the approved banner.

**Evidence:** learn-clinical-review-package.md:23-33 — 'All customer-facing clinical statements were checked against current official guidance on 2026-08-24.' followed by rows for Understanding tinnitus, Tracking patterns, Sleep, Stress, Safe listening, Preparing for an appointment only. src/features/learn/content.ts:67-75 — `slug: 'medicines', title: 'Medicines and tinnitus'` with claims about aspirin, NSAIDs, antibiotics, diuretics and cancer treatments; CLAUDE.md session 2026-10-04 note: 'new "Medicines and tinnitus" guide (en/de/es/fr; needs clinical review like the others)'. The package header also still says 'Review candidate: feature/learn-reports-achievements', a branch already merged into main (git log 5513c30).

**What goes wrong:** A reviewer signs off the package as written (approve all six rows), the 'Clinical review required' marker is removed per the instructions at lines 87-89, and the medicines article — never listed, never reviewed — ships under the approved banner.

**Suggested fix:** Add a 'Medicines and tinnitus' row (claims: ototoxic drug classes, dose-dependence, reversibility, 'never stop on your own'; sources NHS/NIDCD; clinical risk High) and update 'Prepared'/'Review candidate' to the current commit. Consider a tiny script/test that asserts every slug in `en` in content.ts appears in the package table so the two cannot drift again.

### A88. [MEDIUM · testing] Tests exist but cannot be run from the repo: no test/lint/typecheck scripts, tsx not installed, no ESLint config, minimal tsconfig
**Where:** `package.json:5`  ·  **Verifiers upholding:** 3/3

**What:** Three validation scripts under tests/ (features.validation.ts, stats/calibration.test.ts, stats/triggerModel.validation.ts) document `npx tsx` as their runner, but tsx is not a devDependency (package.json:46-51), package.json:5-10 defines no test/lint/typecheck script, there is no ESLint config, CI workflow or git hook, and tsconfig.json only sets `strict`; so the assertions on trigger-model bounds, milestone logic and report escaping are never executed, and unused imports (e.g. app/entry/new.tsx:5 LayoutAnimation) go unflagged.

**Evidence:** package.json:5-10 scripts are start/android/ios/web only; :46-51 devDependencies lack tsx/jest/eslint; `ls node_modules/.bin/tsx` -> not found; `ls eslint.config.* .eslintrc*` -> none. tests/features.validation.ts:1 `// Pure feature checks. Run: npx tsx tests/features.validation.ts`, tests/stats/calibration.test.ts:10 and triggerModel.validation.ts:2 same. tsconfig.json:1-6 `{ extends: 'expo/tsconfig.base', compilerOptions: { strict: true } }`. CLAUDE.md: 'No test runner or linter is configured yet.' Note `npx tsc --noEmit` passed in this review.

**What goes wrong:** A change to triggerModel.ts that breaks the prior-bound assertion, or to reportHtml.ts that drops escaping of notes, merges unnoticed because nothing executes the assertions; unused imports such as LayoutAnimation in entry/new.tsx:5 accumulate because no linter flags them.

**Suggested fix:** Add `tsx` devDependency and scripts `"typecheck": "tsc --noEmit"`, `"lint": "expo lint"`, `"test": "tsx tests/features.validation.ts && tsx tests/stats/triggerModel.validation.ts"`; run them in CI or a pre-push hook; enable `noUncheckedIndexedAccess` and `noUnusedLocals`.

### A89. [MEDIUM · testing] No typecheck, lint or format gate; `tsc` passes today but nothing enforces it
**Where:** `package.json:5`  ·  **Verifiers upholding:** 3/3

**What:** No typecheck, lint, format or test gate exists: package.json scripts are only start/android/ios/web, there is no ESLint/Prettier/Jest config or .github workflow, and tsconfig.json enables only `strict` (no noUnusedLocals/noUncheckedIndexedAccess). `npx tsc --noEmit` passes today and also covers tests/ and plugins/*.js (allowJs), but nothing runs it, so type errors or dead health-data code can merge unnoticed and surface only at Metro bundle time; tests lean on `as any`/`!` (tests/features.validation.ts:51).

**Evidence:** package.json:5-10 scripts: start, android, ios, web; no `jest`/`eslintConfig`/`prettier` keys; `ls jest.config.* .eslintrc* eslint.config.* .prettierrc*` -> none. tsconfig.json:1-6 is `extends expo/tsconfig.base` + `strict: true` only (no noUnusedLocals/noUnusedParameters/noUncheckedIndexedAccess/noFallthroughCasesInSwitch). `npx tsc --noEmit` currently exits 0 and (no `include`) also checks tests/, plugins/*.js (allowJs), App.tsx, index.ts and app.json. CLAUDE.md:12 'No test runner or linter is configured yet.'

**What goes wrong:** A PR introduces a type error or an unused health-data variable; nothing runs tsc or eslint (PR #5 merged with no CI), the error surfaces only when Metro bundles on a device. Tests rely on `!` and `as any` (features.validation.ts:51) because no stricter flags exist.

**Suggested fix:** Add `"typecheck": "tsc --noEmit"` and `"lint": "expo lint"` (install eslint-config-expo), enable `noUnusedLocals` and `noUncheckedIndexedAccess`, and run typecheck+lint+test in a GitHub Action.

### A90. [MEDIUM · testing] Test suite has no runner, is never executed, and is already failing
**Where:** `tests/features.validation.ts:64`  ·  **Verifiers upholding:** 3/3

**What:** The test files are only runnable via `npx tsx` (per their headers) but tsx is not installed or in devDependencies, there is no `test` script or CI, and tests/features.validation.ts:64 still asserts 6 Learn articles per locale while src/features/learn/content.ts now has 7 (medicines added 2026-10-04), so the suite is both never executed and already failing.

**Evidence:** tests/features.validation.ts:1 `// Pure feature checks. Run: npx tsx tests/features.validation.ts`; line 64 `assert(articles.length === 6, ...)`. src/features/learn/content.ts:21-77 defines seven English articles (slugs understanding-tinnitus, tracking-patterns, sleep, stress-and-attention, safe-listening, medicines, appointment); `slug: 'medicines'` (line 68) was added in 9f0b75c on 2026-10-04, while the test was last touched in c066639 on 2026-08-24 when content.ts had 24 slug lines (6 per locale). package.json:5-10 scripts are only start/android/ios/web. `ls node_modules/.bin | grep tsx` is empty and `grep -c '"node_modules/tsx"' package-lock.json` returns 0. `npx tsc --noEmit --listFiles` confirms the tests are type-checked (they compile), which is the only check they ever receive.

**What goes wrong:** Running `npx tsx tests/features.validation.ts` today throws 'en Learn library should contain every guide' after the report/achievement asserts pass. Any regression in buildReportData, evaluateAchievements, HTML escaping of notes, or fitTriggerModel (the health-claim code these tests guard) ships undetected because nothing executes the assertions; the red suite went unnoticed for the entire PR #5 cycle.

**Suggested fix:** Add `tsx` to devDependencies and a `"test": "tsx tests/features.validation.ts && tsx tests/stats/triggerModel.validation.ts"` script (keep the slow calibration study separate). Fix the stale count (derive it from the English array or assert >= 7). Run it in a GitHub Action on every PR.

### A91. [MEDIUM · ux] Custom tab bar buttons discard the accessibility props react-navigation supplies; the Add FAB is an unlabeled icon-only control
**Where:** `app/(tabs)/_layout.tsx:40`  ·  **Verifiers upholding:** 3/3

**What:** `TabBarButton` (line 20/32) forwards only onPress/onLongPress/style, dropping the navigator's `role`, `aria-selected`, `aria-label`, `testID` and `android_ripple`; `AddTabButton` (line 40) ignores all props and renders an icon-only `PressableScale` (line 89) with no accessibility label/role, so the Add FAB is unnamed for screen readers and the tabs lose role/selected state. `tabBarIcon` on line 141 is dead code.

**Evidence:** _layout.tsx:20 `function TabBarButton({ children, onPress, onLongPress, style }: BottomTabBarButtonProps)` and line 32 `<Pressable onPress={onPress} onLongPress={onLongPress} onPressIn=... style={style}>` — nothing else is forwarded. Line 40 `function AddTabButton(_props: BottomTabBarButtonProps)` ignores all props; line 89 renders `<PressableScale onPress={() => router.push('/entry/new')} ...>` with no `accessibilityLabel`/`accessibilityRole`, containing only `<Plus size={28} .../>` (line 96). node_modules/@react-navigation/bottom-tabs/src/views/BottomTabItem.tsx:332-342 shows the navigator passes `testID`, `'aria-label': accessibilityLabel`, `'role': ... 'tab'`, `'aria-selected': focused`. Line 141 `tabBarIcon: () => <Plus .../>` is dead: the custom button never renders `children`.

**What goes wrong:** TalkBack/VoiceOver user swipes across the tab bar: Home/Stats/Calendar/More announce without the tab role or "selected" state; the Add FAB announces as "button" (or nothing) with no name, so the primary action of the app is undiscoverable non-visually. Automated UI tests also cannot target tabs by `testID`.

**Suggested fix:** In `TabBarButton`, destructure `...rest` and spread it onto `Pressable`. In `AddTabButton`, forward `props['aria-label']`/`testID` (or set `accessibilityRole="button"` and `accessibilityLabel={t('tabs.add')}` explicitly) on the `PressableScale`, and remove the unused `tabBarIcon` for the add screen.

### A92. [MEDIUM · ux] Fixed-height text boxes and 9–10pt type break under OS font scaling; no font-scaling strategy exists
**Where:** `app/(tabs)/index.tsx:415`  ·  **Verifiers upholding:** 3/3

**What:** Stat tiles (index.tsx:415-441, trends.tsx:2110-2138) and the tab bar (_layout.tsx:117) use fixed pixel heights around 10-12pt text with no allowFontScaling/maxFontSizeMultiplier anywhere in the app, so at large OS accessibility text sizes labels and captions overflow their rows and overlap neighbouring content; the entry-form scale buttons (new.tsx:578-581) are partly protected by adjustsFontSizeToFit but remain vertically tight.

**Evidence:** grep `allowFontScaling|maxFontSizeMultiplier|getFontScale` → no matches. index.tsx:415-441 `tileLabelWrap: { height: 24 }`, `tileTopWrap: { height: 42 }`, `tileBottomWrap: { height: 17 }` holding 10pt (:420-428) and 12pt (:449-454) text; trends.tsx:2110-2138 same with 30/54/20. new.tsx:578 `scaleBtn: { flex: 1, height: 74, ... }` with a 54px icon + `fontSize: 9` label (:581). (tabs)/_layout.tsx:117 `height: 74 + insets.bottom` with 12pt labels (:177-181). reports.tsx:139 `metricLabel: { fontSize: 9.5 }`, learn/index.tsx:99 `fontSize: 9.5`.

**What goes wrong:** iOS Dynamic Type at the first accessibility size (~1.6×): "AVERAGE INTENSITY" renders at 16pt in a 24pt box → clipped to one line that overflows; the 17pt-high caption row cuts off the "3.2 / 5" value; intensity labels under the icons push past the 74pt button.

**Suggested fix:** Replace fixed heights with minHeight, set `maxFontSizeMultiplier={1.4}` on the dense tiles/tab labels, and raise 9–10pt styles to ≥11pt.

### A93. [MEDIUM · ux] Three dead-end "Coming soon" rows (Pitch Test, Rate app, Widgets) ship in the production More tab
**Where:** `app/(tabs)/more.tsx:111`  ·  **Verifiers upholding:** 3/3

**What:** Pitch Test (line 185), Rate app (254) and Widgets (274) rows all route via the ungated `cs()` helper at line 111 to the placeholder `app/coming-soon.tsx`; no __DEV__/remote-config guard hides them, so release users see fully-styled rows that dead-end on "Coming soon".

**Evidence:** more.tsx:185 `onPress={cs('more.pitchTest')}`, :254 `onPress={cs('more.rateApp')}`, :274 `onPress={cs('more.widgets')}`, where :111 `const cs = (titleKey) => () => router.push({ pathname: '/coming-soon', ... })`. app/coming-soon.tsx:32-33 renders `t('comingSoon.label')` / `t('comingSoon.sub')` (en.json:544-545). The same file already has a remote-config gate pattern at :150 `isPromoBannerEnabled()`.

**What goes wrong:** A user reads "Pitch Test — Identify your tinnitus frequency" (a genuinely useful feature for this audience), taps it, and gets an empty screen with a clock icon. Same for "Rate Tinnitus Tracker — Enjoying the app? Leave a review".

**Suggested fix:** Remove the rows until the features exist, or gate each behind a Remote Config flag like the promo banner. Rate App in particular can be shipped today with expo-store-review.

### A94. [MEDIUM · ux] Internal note "Clinical review required before release" is rendered to users in the Learn footer
**Where:** `app/learn/index.tsx:75`  ·  **Verifiers upholding:** 3/3

**What:** Learn footer unconditionally renders `learn.updated`, whose en/de/es/fr text embeds the internal note "Clinical review required before release" plus a hard-coded "August 2026" date that is not derived from the unused `LEARN_CONTENT_UPDATED` constant.

**Evidence:** app/learn/index.tsx:75 `<Text style={ss.footer}>{t('learn.updated')}</Text>` (no `__DEV__` guard). app/i18n/locales/en.json:299 `"updated": "Content updated August 2026 · Clinical review required before release"`; de.json:260 "Klinische Prüfung vor Veröffentlichung erforderlich", es/fr equivalent. src/features/learn/content.ts:303 `export const LEARN_CONTENT_UPDATED = '2026-08-24'` is never imported by any screen, so the date in the string will drift from the content date.

**What goes wrong:** Any user opens More > Learn and reads, at the bottom of a health-education list, that the content has not been clinically reviewed; the date is frozen at August 2026 even after content changes.

**Suggested fix:** Replace with a user-facing "Content updated {{date}}" interpolated from `LEARN_CONTENT_UPDATED` (formatted in the app language) and keep the review reminder in a code comment or a `__DEV__`-only badge.

### A95. [LOW · architecture] No data-access layer: screens call SQLite directly in render/focus, duplicate derived facts, and pass state through a module-level global
**Where:** `app/(tabs)/_layout.tsx:45`  ·  **Verifiers upholding:** 3/3

**What:** No data-access layer: 27 files outside app/db import queries.ts directly, every screen hand-rolls fetch-on-focus (trends.tsx adds its own fingerprint cache, calendar.tsx double-queries each month change at :176-178 plus :207/:216), the 'logged today?' fact is computed from two separate queries (_layout.tsx:17 and index.tsx:101-103, the former running a synchronous SQLite read inside render on every pathname change), and calendarNav.ts:10 uses a mutable module global to hand a date between screens because no shared store exists. Not a user-visible bug today — focus refetches keep data fresh — but each new consumer re-implements the pattern and the workarounds keep accumulating.

**Evidence:** (tabs)/_layout.tsx:15-18 `getRecentEntries(50).some(...)` called from :44-45 `usePathname(); const remind = !hasEntryToday();` i.e. a DB read inside render on every navigation; app/(tabs)/index.tsx:101-103 recomputes the same from its own `getRecentEntries(200)`. Focus refetches: index.tsx:89-94, trends.tsx:1483-1495, calendar.tsx:146-172 (+ :176-178 and :207/:216 double-fetch per month change), more.tsx:126-128, profile.tsx:52-58, my-data.tsx:127, reports.tsx:31, achievements.tsx:44. app/utils/calendarNav.ts:10 `let pendingCalendarDate: string | null = null;` with the 9-line comment explaining why. ExpandableEntryRow.tsx:65,133 issues two more queries per expanded row.

**What goes wrong:** Adding any screen that shows entries means re-implementing fetch+focus+fingerprint; a change made on one screen is only visible on another after a focus event (e.g. More's milestone badge, Profile's active counts); the Add FAB re-queries 50 rows on every push/pop including Settings sub-screens; cross-screen hand-offs keep growing ad-hoc globals.

**Suggested fix:** Introduce a thin repository + hook layer over queries.ts (e.g. `useEntries(range)`, `useTodayLogged()`, `useSettings()`) backed by a tiny event bus or TanStack Query with explicit invalidation on saveEntry/updateEntry/deleteEntry/import/deleteAll; keep screens free of db imports.

### A96. [LOW · architecture] Home computes its 7-day stats from a 200-row cap while Stats uses 1000, so the two can disagree despite the comment promising they cannot
**Where:** `app/(tabs)/index.tsx:92`  ·  **Verifiers upholding:** 3/3

**What:** Home computes its 7-day change/leading-value stats from getRecentEntries(200) (a row cap, not a 14-day date window) while Stats uses getRecentEntries(1000); for a user with >~14 entries/day the previous-week window is truncated on Home only, so the Change tile can disagree with Stats despite the comment at index.tsx:105-107 claiming they cannot. Fetch by local_date (today-13 onward) or match the Stats cap.

**Evidence:** index.tsx:88 and :92 `getRecentEntries(200)`; index.tsx:105-107 comment: "built from the same shared functions ... so the two screens can never disagree about what 'this week' means". trends.tsx:1484 `getRecentEntries(1000)`. queries.ts:209-213 `SELECT * FROM entries ORDER BY created_at DESC LIMIT ?`. sevenDayTrend.ts:306-315 `periodAverages` filters `p.tsList` for days -13..-7; :400 `computeLeadingValue` filters for `e.day < windowStartDayStr`.

**What goes wrong:** User averaging 15+ entries/day (several self-initiated check-ins plus the scheduled prompt), or who imported a dense backup: 200 rows cover ~13 days, so Home's previous-week average is computed from a partial window (or is null) while Stats 7D shows the full comparison — the Change tile differs between the two screens.

**Suggested fix:** Fetch by date for this screen (e.g. `WHERE local_date >= ?` with today-13 as the key, no LIMIT), or raise the cap to match Stats. Keep the 20-row list slice separate from the stats input.

### A97. [LOW · architecture] Eight context providers re-implement the same get/setSetting boilerplate and nest eight deep
**Where:** `app/contexts/ThemeContext.tsx:27`  ·  **Verifiers upholding:** 3/3

**What:** Theme, ChartType, FirstDayOfWeek, IntensityScale and Language contexts duplicate the same validated getSetting/setSetting useState boilerplate (ThemeContext.tsx:27-40, ChartTypeContext.tsx:19-27, FirstDayOfWeekContext.tsx:35-43, IntensityScaleContext.tsx:16-24, LanguageContext.tsx:76-96) and are stacked as eight nested providers in app/_layout.tsx:115-131; a small shared `usePersistedSetting(key, allowed, default)` hook would remove the repetition. The claimed render cascade across providers does not occur: each provider's stable `children` element prevents re-rendering sibling contexts' consumers, so the unmemoised value literals only matter when that setting itself changes.

**Evidence:** app/_layout.tsx:115-133 eight nested providers. Identical shape in ThemeContext.tsx:27-40, ChartTypeContext.tsx:19-27, FirstDayOfWeekContext.tsx:35-43, IntensityScaleContext.tsx:16-24, LanguageContext.tsx:76-96, OnboardingContext.tsx:17-28, AppLockContext.tsx:24,58-62, SubscriptionContext.tsx:24-32 (`const saved = getSetting('...'); return (ALL_SETTINGS as string[]).includes(saved ?? '') ? ... : default` repeated 4x verbatim). Context values are fresh object literals (ThemeContext.tsx:45, LanguageContext.tsx:99, etc.).

**What goes wrong:** Each new preference (e.g. a planned analytics opt-out) costs a new context file, a provider edit in _layout.tsx, a settings screen and a Settings row; reading `useTheme()` in ~40 components means every provider re-render re-renders all of them because the value identity changes.

**Suggested fix:** One typed `SettingsProvider` with a schema `{ theme, chartType, firstDayOfWeek, intensityScale, language, appLockEnabled, onboardingCompleted }`, a `useSetting(key)` selector hook (or Zustand/Jotai with a SQLite persister) and memoised values; keep Subscription separate since it is remote state.

### A98. [LOW · bug] "Today" is captured at render time on both tab screens, so neither notices a date rollover while it is on screen
**Where:** `app/(tabs)/calendar.tsx:78`  ·  **Verifiers upholding:** 3/3

**What:** Calendar's `todayStr` (calendar.tsx:78-79) and Home's `hasEntryToday` (index.tsx:100-103) are computed from `new Date()` at render/memo time and only refreshed by a navigation focus event; the tab screens stay mounted and nothing listens to AppState, so after a date rollover while the app sits on the tab (or backgrounded with App Lock off — with App Lock on, the LockScreen swap remounts the tabs and masks it) the new day is treated as "future" on Calendar and Home keeps hiding the Log CTA/subline until the user switches tabs.

**Evidence:** calendar.tsx:78-79 `const today = new Date(); const todayStr = toLocalDateStr(today);` used by the guard at :225 `if (dateStr > todayStr) { showFutureToast(); return; }` and :296. index.tsx:100-103 `const hasEntryToday = useMemo(() => { const todayStr = formatDateKey(new Date()); return entries.some(...); }, [entries]);` gates the CTA at :161 and the subline at :146. Neither screen subscribes to `AppState`; `AppLockContext` already re-checks on 'active' for an analogous reason (CLAUDE.md, session 2026-08-24).

**What goes wrong:** User leaves the app on the Calendar tab at 23:55, locks the phone, unlocks at 00:10: tapping the new day's cell shows "Can't log entries for future days". Same cycle on Home with an entry logged the previous evening: "Log for Today" stays hidden and the "How are you feeling today?" subline is missing until the user switches tabs and back.

**Suggested fix:** Keep a `todayKey` in state refreshed from an `AppState` 'active' listener (and in the focus effect), and derive `todayStr`/`hasEntryToday` from it; or at minimum recompute inside the focus effect and the 'active' transition.

### A99. [LOW · bug] Pending-date focus branch leaves `skipFocusResetRef` armed, so the next ordinary tab return skips the snap-to-today once
**Where:** `app/(tabs)/calendar.tsx:159`  ·  **Verifiers upholding:** 3/3

**What:** After a delete-return handled by the focus fallback (no remount), the pending-date branch returns at line 159 without clearing `skipFocusResetRef` (set by `onEditPress` at line 371), so the next ordinary Calendar tab focus skips the snap-to-current-month once.

**Evidence:** calendar.tsx:371 `onEditPress={() => { skipFocusResetRef.current = true; }}` runs before every edit push. entry/[id].tsx:292-294 on delete: `setPendingCalendarDate(entryLocalDateRef.current); router.replace('/calendar');`. calendar.tsx:153-160: `const pendingDate = consumePendingCalendarDate(); if (pendingDate) { ...setState...; return; }` — no `skipFocusResetRef.current = false`. Lines 161-166 then honour the stale flag on the next focus. The comment at 148-152 acknowledges this no-remount path is possible.

**What goes wrong:** On the no-remount path: user edits an entry on 12 Aug (viewing August), deletes it -> calendar lands on 12 Aug correctly. User goes to Home, then back to Calendar -> instead of snapping to the current month as it does on every other tab return, it stays on August once.

**Suggested fix:** Clear the flag in the pending branch: `skipFocusResetRef.current = false;` before `return;` at line 159.

### A100. [LOW · bug] "Yesterday" is derived by subtracting 24 h, which is not one calendar day across a DST change
**Where:** `app/(tabs)/index.tsx:48`  ·  **Verifiers upholding:** 3/3

**What:** `formatEntryDate` derives the "Yesterday" key by subtracting 24 h from now and formatting in the local zone; during the first hour after midnight following a spring-forward day this yields two days back, so yesterday's entries show a full date label instead of "Yesterday". Fall-back days are unaffected. Use `d.setDate(d.getDate() - 1)` like sevenDayTrend.ts does.

**Evidence:** index.tsx:48 `const yesterday = formatDateKey(new Date(Date.now() - 86400000));` compared at line 51 `if (entry.local_date === yesterday)`. Every other window computation in the same pipeline uses calendar arithmetic instead (sevenDayTrend.ts:62 `cutoff.setDate(cutoff.getDate() - (days - 1))`, :130, :309-311).

**What goes wrong:** Monday 00:30 local, the day after a spring-forward Sunday (23 h long): 00:30 minus 24 h = Saturday 23:30, so `yesterday` = Saturday. An entry logged Sunday 21:00 renders as "Sun, Mar 8 · 21:00" instead of "Yesterday · 21:00" until 01:00.

**Suggested fix:** `const d = new Date(); d.setDate(d.getDate() - 1); const yesterday = formatDateKey(d);` — same idiom the rest of the stats code already uses.

### A101. [LOW · bug] Greeting is computed once per mount and never refreshes with the time of day
**Where:** `app/(tabs)/index.tsx:96`  ·  **Verifiers upholding:** 3/3

**What:** Time-of-day greeting is memoized on `[t]` only (line 96) while `greeting()` reads the clock (line 36); since the Home tab never unmounts and no focus/AppState hook recomputes it, the greeting stays at whatever period the app was first opened in until a restart or language change.

**Evidence:** index.tsx:96 `const greet = useMemo(() => greeting(t), [t]);` — `greeting()` reads `new Date().getHours()` (line 36). `t` from react-i18next is referentially stable until the language changes. Lines 111-113 state: "Home's tab screen stays mounted for the app's whole lifetime (bottom tabs don't unmount on switch), so the useState initializer above only ever ran once". The focus effect (lines 89-94) re-renders the screen but a `[t]`-keyed memo does not recompute.

**What goes wrong:** User opens the app at 11:50 -> headline reads "Good morning, Alex". They background it and return at 15:00 (process still alive), switch tabs and come back -> headline still reads "Good morning, Alex" until the app is killed or the language is changed.

**Suggested fix:** Drop the memo (it is a trivial computation) or recompute it inside the existing `useFocusEffect` callback, e.g. keep `greet` in state and set it alongside `setUserName`/`setEntries`. Pair with an `AppState` -> 'active' refresh if you also want it correct after a background/foreground without a tab switch.

### A102. [LOW · bug] Change caption can print "-0%" / "+0%" because the sign is taken from the unrounded value
**Where:** `app/(tabs)/index.tsx:237`  ·  **Verifiers upholding:** 3/3

**What:** Change caption can read "-0%" / "+0%" because the sign is taken from the unrounded percent while the magnitude is toFixed(0); same code is duplicated in app/(tabs)/trends.tsx:1654-1655.

**Evidence:** index.tsx:237-238 `{(periodChangePercent ?? 0) > 0 ? '+' : (periodChangePercent ?? 0) < 0 ? '-' : ''}{Math.abs(periodChangePercent ?? 0).toFixed(0)}%`.

**What goes wrong:** Previous week average 2.50, this week 2.49 -> percent = -0.4 -> prefix '-' and magnitude "0" -> caption reads "-0%".

**Suggested fix:** Round first (`const pct = Math.round(periodChangePercent ?? 0)`) and derive the sign from `pct`.

### A103. [LOW · bug] Startup DB initialisation has no error path: a failing migration crashes the app without being reported
**Where:** `app/_layout.tsx:96`  ·  **Verifiers upholding:** 3/3

**What:** initDatabase() (migrations, backfills, seeds) runs inside try/finally with no catch at app/_layout.tsx:96-106, unlike the adjacent initRemoteConfig/initPurchases calls that route errors to recordError. A SQLite failure at startup escapes the effect, unmounts the root tree (no ErrorBoundary anywhere in app/), and crashes the app on every launch with no user-facing message or recovery path. Crashlytics' global JS handler would still log the fatal in release builds, but without the context breadcrumb and with no way for the user to export data or escape the crash loop.

**Evidence:** app/_layout.tsx:96-106 `try { initDatabase(); const reminders = getReminders(); ... } finally { setAppReady(true); }` — no catch; crashlytics wrapper exists (`recordError`, imported at :12) but is only used for remote config/purchases.

**What goes wrong:** A disk-full device or a future migration bug (e.g. ensureColumn on a locked DB) throws on launch -> immediate crash on every start with no breadcrumb in Crashlytics and no user-facing message.

**Suggested fix:** Add a catch that calls recordError(err, 'initDatabase failed') and renders a minimal error screen with a 'Send report / Export data' option instead of a crash loop.

### A104. [LOW · bug] Name uniqueness is case-sensitive in the schema but case-insensitive in the add path
**Where:** `app/db/database.ts:15`  ·  **Verifiers upholding:** 3/3

**What:** `tinnitus_types.name` (database.ts:15) and `triggers.name` (database.ts:22) are `UNIQUE` under default BINARY collation, while `addCustomTinnitusType`/`addCustomTrigger` (queries.ts:124, :162) dedupe with `COLLATE NOCASE`. The seed functions' `INSERT OR IGNORE` (database.ts:193-197, 224-228) therefore will not match a pre-existing custom row that differs only by case, so a built-in added in a later update can coexist with the user's custom spelling as two active chips with separate histories. Fix: declare `UNIQUE COLLATE NOCASE` for new installs and have the seed functions check `name = ? COLLATE NOCASE` before inserting on existing DBs.

**Evidence:** database.ts:15 and :22 `name TEXT NOT NULL UNIQUE` (case-sensitive by default); seeds use `INSERT OR IGNORE` with exact names (database.ts:194-199, 225-230) and new built-ins are added over time (e.g. `splitPulsatileThrummingType` + 'Thrumming', lines 163-189). queries.ts:124 and :162 check `WHERE name = ? COLLATE NOCASE` before inserting a custom row.

**What goes wrong:** User adds custom trigger 'dehydration'. A later app update adds built-in 'Dehydration' to `seedTriggers`; `INSERT OR IGNORE` does not match the lowercase row, so both rows exist and the entry form shows two near-identical chips whose histories never merge.

**Suggested fix:** Declare `name TEXT NOT NULL UNIQUE COLLATE NOCASE` for new installs and make the seed functions check `COLLATE NOCASE` before inserting on existing ones.

### A105. [LOW · bug] Pulsatile/Thrumming split migration no-ops if the user already created a custom 'Pulsatile', leaving the combined built-in row forever
**Where:** `app/db/database.ts:177`  ·  **Verifiers upholding:** 3/3

**What:** splitPulsatileThrummingType() returns early when any row named exactly 'Pulsatile' already exists, leaving the built-in 'Pulsatile / Thrumming' row in place (non-deletable, is_custom = 0) next to the user's custom 'Pulsatile' and the newly seeded 'Thrumming'; the user can only hide it by disabling it, not remove or merge it. The exact-match check also diverges from addCustomTinnitusType's COLLATE NOCASE lookup, so a custom 'pulsatile' ends up alongside a renamed built-in 'Pulsatile'.

**Evidence:** app/db/database.ts:174-177 `const pulsatileExists = db.getFirstSync("SELECT id FROM tinnitus_types WHERE name = 'Pulsatile'"); if (pulsatileExists) return;` — the combined row is neither renamed nor retired. Custom sound types shipped in 3fb17d1 (2026-09-21, part of 1.1.0, app.json bumped at c183571 2026-09-14), the split landed later in bad1cb3, so this is a real upgrade path. Lookup is case-sensitive (`name = 'Pulsatile'`) while app/db/queries.ts:124 adds customs with `COLLATE NOCASE`, so a custom 'pulsatile' does not block the rename and yields 'pulsatile' (custom) plus 'Pulsatile' (built-in) side by side.

**What goes wrong:** User on 1.1.0 adds custom sound type 'Pulsatile' (allowed, since the built-in was 'Pulsatile / Thrumming'), logs entries with it, then updates. Sound Types screen now lists 'Pulsatile' (custom), 'Pulsatile / Thrumming' (built-in, cannot be deleted, still attached to old entries) and 'Thrumming'; the entry form shows both Pulsatile variants as chips.

**Suggested fix:** When a 'Pulsatile' row already exists, re-point `entry_tinnitus_types.tinnitus_type_id` from the combined row to it (INSERT OR IGNORE then DELETE the combined row), or at least mark the combined row `is_active = 0`; use COLLATE NOCASE in the existence check to match addCustomTinnitusType.

### A106. [LOW · bug] Entry save has no error path: a failed SQLite write throws inside the press handler and crashes the app with no message
**Where:** `app/entry/new.tsx:321`  ·  **Verifiers upholding:** 3/3

**What:** handleSave in app/entry/new.tsx (saveEntry, line 321) and app/entry/[id].tsx (updateEntry, line 267) call synchronous, non-transactional runSync writes directly from onPress with no try/catch and no error boundary anywhere in the app; a SQLite failure (disk full, locked DB) throws out of the press handler, crashes a release build, loses the form input, can leave a partially written entry (join rows missing), and is never reported via recordError.

**Evidence:** new.tsx:321-331 `saveEntry({...})` followed by :332-335 analytics/achievements/`setSaved(true)` with no try/catch; [id].tsx:267-277 `updateEntry(Number(id), {...})` likewise. Contrast my-data.tsx:180-183 `catch (err) { recordError(err, 'export failed'); setStatus({ variant: 'error', ... }) }`.

**What goes wrong:** Device storage full (SQLITE_FULL) or a locked database: tapping Save throws from the event handler; in a release build the JS exception terminates the app, the user's form input is lost, and nothing is reported to Crashlytics as a handled error.

**Suggested fix:** Wrap the write in try/catch, recordError, and show a StatusDialog with a retry; keep the form state intact.

### A107. [LOW · bug] Keyboard overlap subtracts the bottom safe-area inset on iOS too, over-lifting the footer
**Where:** `app/hooks/useKeyboardOverlap.ts:21`  ·  **Verifiers upholding:** 3/3

**What:** useKeyboardOverlap subtracts insets.bottom from the keyboard top on all platforms, but iOS's endCoordinates.height already reaches the screen bottom; on a home-indicator iPhone the entry screens' sticky footer is lifted ~34 pt above the keyboard, leaving a visible background gap. Use endCoordinates.screenY or make the subtraction Android-only.

**Evidence:** app/hooks/useKeyboardOverlap.ts:20-21: comment "endCoordinates.height excludes the nav bar inset on Android" followed by `const keyboardTop = Dimensions.get('screen').height - e.endCoordinates.height - insets.bottom;` with no Platform check. The result is applied as root `paddingBottom` on both entry screens (new.tsx:339, [id].tsx:301).

**What goes wrong:** iPhone with home indicator (insets.bottom = 34): focusing Notes lifts the sticky Save footer 34 pt above the top of the keyboard, leaving a visible gap of background colour between keyboard and footer.

**Suggested fix:** Use `e.endCoordinates.screenY` as the keyboard top (available on both platforms) or only subtract `insets.bottom` when `Platform.OS === 'android'`.

### A108. [LOW · bug] Source links call `Linking.openURL` without handling rejection, unlike the support directory
**Where:** `app/learn/[slug].tsx:55`  ·  **Verifiers upholding:** 3/3

**What:** `Linking.openURL` is called without await/catch here and in five other screens (about.tsx:14, connect.tsx:43, support.tsx:54, support-directory.tsx:139, (tabs)/more.tsx:133); only support-directory.tsx:73-79 handles rejection with an error dialog, so elsewhere a failed open is silent (and logs an unhandled rejection in dev).

**Evidence:** app/learn/[slug].tsx:55 `onPress={() => Linking.openURL(source.url)}`. Compare app/support-directory.tsx:73-79, which wraps the same call in try/catch and shows `StatusDialog` on failure.

**What goes wrong:** Device with no browser / a managed profile that blocks web intents: tapping 'NICE NG155 — Tinnitus' does nothing; in dev builds an 'Unhandled promise rejection' warning is logged.

**Suggested fix:** Reuse the support-directory pattern (await + catch → error dialog).

### A109. [LOW · bug] Import does not re-evaluate milestones, so the More-tab 'new' badge never fires for restored data
**Where:** `app/my-data.tsx:200`  ·  **Verifiers upholding:** 3/3

**What:** `handleImport` calls `importEntries` then `refresh()`/`logEvent` only; `syncAchievements()` (called after entry save/edit in app/entry/new.tsx:333 and app/entry/[id].tsx:279) is never run after an import, so milestones reachable from restored data are first unlocked by the Milestones screen's own focus effect (app/achievements.tsx:45-52) and marked seen on blur (:58-60) — the More-tab unseen badge (app/(tabs)/more.tsx:126-128) never shows them.

**Evidence:** app/my-data.tsx:200-202 calls `importEntries` then `refresh()` and `logEvent` only; `syncAchievements` call sites are app/entry/new.tsx:333 and app/entry/[id].tsx:279 (grep). app/achievements.tsx:47-52 unlocks on focus and :58-60 marks seen on blur; src/features/achievements/sync.ts:3-8 describes this as the bug being fixed. app/(tabs)/more.tsx:126-128 reads `countUnseenAchievements()` on focus.

**What goes wrong:** Fresh install, restore a 60-day backup: 'A week of observations', 'Steady week', 'A clearer picture' are all reachable but the More tab shows no count; they only unlock when the user happens to open Milestones.

**Suggested fix:** Call `syncAchievements()` after a successful import (inside the same flow as `refresh()`).

### A110. [LOW · bug] rangeDayCount('All') counts days from a UTC instant while every other Stats figure uses local day keys, so the Entries tile can read '2 of 1 days'
**Where:** `app/stats/sevenDayTrend.ts:300`  ·  **Verifiers upholding:** 3/3

**What:** rangeDayCount('All') rounds the elapsed milliseconds since the oldest created_at (UTC instant) to whole days instead of counting local calendar days from oldestDay, so the Stats Entries tile's "of N days" can be one day too low or too high (e.g. oldest entry yesterday 13:00 viewed today 00:30 → "of 1 days" for a two-day diary), inconsistent with every other Stats figure which uses local_date keys. Only the "All" range on the Stats tab is affected; Home always uses '7D'.

**Evidence:** l.300 `Math.max(1, Math.round((Date.now() - p.oldestTs) / 86400000) + 1)`; oldestTs is `new Date(e.created_at).getTime()` (l.34-37) whereas filterItems (l.64), buckets (l.117) and the model use `e.day` = local_date.

**What goes wrong:** Entries at 23:30 yesterday and 00:30 today (two local days): elapsed = 1h → round(0.04) + 1 = 1 → tile shows '2 of 1 days'. Over a long diary the UTC/local offset and DST shifts can also make it one day off.

**Suggested fix:** Compute the span from `p.oldestDay` to today's local key: `daysBetween(oldestDay, formatDateKey(new Date())) + 1`.

### A111. [LOW · bug] Overlapping syncReminderNotifications calls interleave cancel-all/schedule and produce duplicate notifications
**Where:** `app/utils/notifications.ts:116`  ·  **Verifiers upholding:** 3/3

**What:** syncReminderNotifications (cancel-all then re-schedule, plus re-arming the anchor) is never serialized and is called fire-and-forget without .catch from app/reminders.tsx:53 and app/_layout.tsx:101; two overlapping runs (rapid toggles, or a toggle during the startup sync) each schedule every reminder and the anchor after both cancels, yielding duplicate daily notifications that nothing can detect since no ids are persisted, and any native rejection is silently swallowed.

**Evidence:** app/utils/notifications.ts:117 `await Notifications.cancelAllScheduledNotificationsAsync();` followed by a sequential `await scheduleNotificationAsync` per reminder (:119-133) with no mutex. app/reminders.tsx:51-54 `function refreshAndSync(next) { setReminders(next); syncReminderNotifications(next, t); }` — not awaited, no catch; called from toggleEnabled (:59), handleTimeChange (:69), handleAddReminder (:75), confirmDelete (:84). app/_layout.tsx:100-102 starts another run at launch, also un-awaited and without `.catch`.

**What goes wrong:** User toggles reminder A on and within ~100 ms changes reminder B's time (or opens the Reminders screen and toggles right after cold start while the startup sync is still running). Interleaving: run1 cancelAll → run2 cancelAll → run1 schedules A,B → run2 schedules A,B → every reminder fires twice daily. Because no notification ids are persisted, nothing detects this; it only self-heals at the next sync. Separately, any rejection (e.g. a malformed `time` producing NaN hour → scheduleNotificationAsync validation error) is an unhandled promise rejection: silent in release, reminders simply stop being scheduled.

**Suggested fix:** Serialize syncs through a module-level promise chain (`let chain = Promise.resolve(); export function syncReminderNotifications(...) { chain = chain.then(() => doSync(...)).catch(err => recordError(err, 'reminder sync failed')); return chain; }`) or debounce to the latest DB state. Add `.catch(recordError)` at both call sites.

### A112. [LOW · bug] Reminder sync is cancel-all-then-reschedule with no serialisation; overlapping toggles can leave a disabled reminder scheduled
**Where:** `app/utils/notifications.ts:117`  ·  **Verifiers upholding:** 3/3

**What:** syncReminderNotifications (cancel-all then per-reminder schedule, no serialisation or generation guard) is fired without await/catch from reminders.tsx refreshAndSync and _layout.tsx launch; overlapping runs can interleave so an earlier run's schedule lands after a later run's cancel-all, leaving a reminder the UI shows as off (or a stale time) scheduled, and the launch sync skips cleanup when no reminder is enabled. Native rejections are unhandled.

**Evidence:** notifications.ts:117 `await Notifications.cancelAllScheduledNotificationsAsync();` followed by one awaited `scheduleNotificationAsync` per enabled reminder (:122-132). reminders.tsx:51-54 `function refreshAndSync(next) { setReminders(next); syncReminderNotifications(next, t); }` — not awaited, not caught, no in-flight guard; also started from _layout.tsx:100-102 on launch.

**What goes wrong:** User flips a reminder on and immediately off (double tap on the Switch). Run A (enabled list) awaits cancelAll; run B (disabled list) awaits cancelAll; A resumes and schedules the reminder daily; B has nothing to schedule. The UI shows the reminder off but it fires at the chosen time every day until the next sync. Any rejection from the native scheduler is an unhandled promise rejection with no user feedback.

**Suggested fix:** Serialise syncs through a single promise chain (e.g. `syncQueue = syncQueue.then(() => doSync(...))`) and compute the reminder list inside the queued task from the DB rather than from the caller's snapshot, so the last write wins; await and catch in callers (recordError + StatusDialog).

### A113. [LOW · bug] 'First pattern' milestone requires 90% probability while Trigger Impact states a direction at 60%
**Where:** `src/features/achievements/evaluate.ts:81`  ·  **Verifiers upholding:** 3/3

**What:** `PATTERN_PROBABILITY = 0.9` gates the 'First pattern' milestone, but the Trigger Impact card (app/(tabs)/trends.tsx:316) and the PDF (src/features/reports/reportHtml.ts:97) state a direction at >= 0.6; the comment claiming the thresholds match is wrong, so a trigger shown as e.g. "78% worse" leaves the milestone locked. (Also note the milestone fits over the whole diary while the card fits over the selected range, so even an aligned threshold would not guarantee agreement.)

**Evidence:** src/features/achievements/evaluate.ts:79-81 `const PATTERN_PROBABILITY = 0.9;` with comment 'Probability at which Trigger Impact itself states a direction with confidence'. app/(tabs)/trends.tsx:316-321 `prob >= 0.6 ? t(worse ? 'stats.trigger.probWorse' : ...)` and src/features/reports/reportHtml.ts:97 `probability >= .6`. en.json `achievements.items.pattern_found.body`: 'Log enough that Trigger Impact can show a clear association.'

**What goes wrong:** Trigger Impact shows 'Caffeine — 78% worse' and the PDF prints '78% worse' under Evidence, yet Milestones still shows 'First pattern' locked with no progress indicator (one-shot, `target: 1`), contradicting its own description.

**Suggested fix:** Either align `PATTERN_PROBABILITY` with the UI threshold (0.6) or reuse the model's `robustness !== 'none'` so the milestone and the card agree on what 'a clear association' is.

### A114. [LOW · bug] PDF report drops out-of-range intensities from the distribution but keeps them in entries/average/max and draws the trend point off-canvas
**Where:** `src/features/reports/reportData.ts:84`  ·  **Verifiers upholding:** 3/3

**What:** Report headline metrics (entries, average, min/max, percent denominator) use unfiltered intensities while the distribution only buckets exact integers 0-5; an out-of-range or non-integer intensity (reachable via importEntries, which only checks typeof number, with no DB CHECK) makes the PDF's own numbers disagree and draws the trend vertex outside the SVG.

**Evidence:** src/features/reports/reportData.ts:84 `Array.from({ length: 6 }, (_, level) => values.filter(value => value === level).length)` vs :98 `entries: entries.length`, :102 average over all `values`, :104 `maximum: Math.max(...values)`. src/features/reports/reportHtml.ts:86 prints `${data.minimum}–${data.maximum} / 5`; reportHtml.ts:27 `y = pad + ((5 - point.intensity) / 5) * (height - pad * 2)` goes negative for intensity > 5, placing the polyline point outside the SVG viewBox.

**What goes wrong:** After importing a backup with one `intensity: 8` entry among 9 valid ones, the PDF says Entries 10, Range 1–8 / 5, average inflated, while the Distribution table's counts sum to 9 and percentages are computed over 10; the trend line has a vertex clipped above the chart.

**Suggested fix:** Validate intensity on import (same fix as above); in buildReportData, filter `values` to the 0–5 domain once and derive entries/average/min/max/distribution from the same filtered list so the report is internally consistent.

### A115. [LOW · bug] 'Generated' date in the PDF is the UTC date, not the user's local date
**Where:** `src/features/reports/reportHtml.ts:13`  ·  **Verifiers upholding:** 3/3

**What:** `date()` slices the first 10 chars of `generatedAt` (a UTC ISO string from reportData.ts:94) and formats that as a local calendar day, so the PDF's "Generated" date is off by one for users whose local date differs from UTC at generation time; `startDate`/`endDate` are unaffected because they are already local date keys.

**Evidence:** src/features/reports/reportData.ts:94 `generatedAt: now.toISOString()`; src/features/reports/reportHtml.ts:13 `new Date(`${value.slice(0, 10)}T12:00:00`)` and :80 `date(data.generatedAt, locale)`. The same helper is correct for `startDate`/`endDate`/note dates because those are already local `YYYY-MM-DD` keys.

**What goes wrong:** User in New York creates a report at 21:00 on 5 Oct → ISO is 2026-10-06T01:00Z → PDF header reads 'Generated 6 Oct 2026'. A user in Tokyo at 07:00 on 6 Oct gets '5 Oct'.

**Suggested fix:** Store `generatedAt` as a local date key (reuse `localDateKey(now)` from reportData.ts:35) or format the full timestamp with `Intl.DateTimeFormat` without slicing.

### A116. [LOW · code-quality] AGENTS.md is a stale August snapshot committed in October and contradicts CLAUDE.md
**Where:** `AGENTS.md:3`  ·  **Verifiers upholding:** 3/3

**What:** AGENTS.md (added whole in 9b86f01, 2026-10-04) is an August-era snapshot of CLAUDE.md addressed to "Codex": it lists shipped features (onboarding, Stats) as open TODOs, documents a reversed add-screen convention, and references the unused PlaceholderScreen; CLAUDE.md:34 and :47 carry the same stale PlaceholderScreen and getRecentEntries(200) facts.

**Evidence:** `git show 9b86f01 --stat -- AGENTS.md` -> 154 insertions (whole file); `diff AGENTS.md CLAUDE.md | grep -c '^[<>]'` -> 124. AGENTS.md:3 'guidance to Codex (Codex.ai/code)'; :47 'PlaceholderScreen — used by Stats, Calendar, More tabs while unimplemented' (grep shows zero imports of PlaceholderScreen); :53 'The add screen resets all form state on focus ... router.replace('/')' (CLAUDE.md says it keeps state and navigates back); :131-132 '[ ] Implement onboarding flow', '[ ] Implement Stats screen'. CLAUDE.md: 'getRecentEntries(200)' (trends.tsx:1484 uses 1000), same PlaceholderScreen claim.

**What goes wrong:** An agent or contributor opening AGENTS.md (the file name most tools look for) re-implements onboarding/Stats or follows the superseded add-screen convention; the two files will keep diverging with every session log appended to CLAUDE.md only.

**Suggested fix:** Replace AGENTS.md with a one-line pointer to CLAUDE.md (or a symlink), move the per-session 'What was built' logs out of CLAUDE.md into docs/CHANGELOG.md, and keep CLAUDE.md to current architecture + conventions.

### A117. [LOW · code-quality] AGENTS.md is a stale fork of CLAUDE.md with contradicting guidance; CLAUDE.md itself misstates the intensity scale
**Where:** `AGENTS.md:53`  ·  **Verifiers upholding:** 3/3

**What:** AGENTS.md is an actively edited fork of CLAUDE.md that stops at session 2026-08-15 and at line 53 asserts the add screen resets its form on focus, which CLAUDE.md:53 explicitly reverses; separately, CLAUDE.md:28 documents intensity as 1–5 while the form (app/entry/new.tsx:62, theme.ts:2) records 0–5 with 0 = 'None' and only null is rejected on save (new.tsx:308).

**Evidence:** AGENTS.md:53 'The add screen resets all form state on focus via useFocusEffect and navigates back with router.replace('/') after save.' vs CLAUDE.md:53 'The add screen keeps its form state across navigation ... Only its sound-type/trigger option lists reload on focus.'; `diff AGENTS.md CLAUDE.md` shows AGENTS.md (154 lines) lacks everything after 2026-08-15 (CLAUDE.md 238 lines). CLAUDE.md:28 '`entries` — tinnitus log entries with `intensity` (required, 1–5)'; app/entry/new.tsx:62 `Array.from({ length: 6 }, (_, i) =>` with :91 `INTENSITY_LABELS[i]` and app/constants/theme.ts:2 `['None','Faint','Mild','Moderate','Loud','Severe']` (0–5); app/stats/triggerModel.ts:69 correctly says '0–5 momentary scale'.

**What goes wrong:** An agent or contributor reading AGENTS.md re-introduces the form reset 'to match the docs', or writes validation/tests assuming intensity >= 1 and treats legitimate 'None' (0) entries as invalid.

**Suggested fix:** Make AGENTS.md a one-line pointer to CLAUDE.md (or a symlink) and fix the scale wording in CLAUDE.md's schema summary.

### A118. [LOW · code-quality] Dead template entry (App.tsx/index.ts) and stale README/prompt.txt describe an app that does not exist
**Where:** `README.md:35`  ·  **Verifiers upholding:** 3/3

**What:** Dead create-expo-app entry files (App.tsx, index.ts — unused since package.json main is expo-router/entry, but still type-checked) plus a stale README (accounts, Express backend, Firebase Auth, missing LICENSE.md) and prompt.txt (React Navigation/React Query, /src/screens) describe an architecture the app does not have.

**Evidence:** package.json:4 `"main": "expo-router/entry"`, yet index.ts:3-8 registers App.tsx, whose body is the 'Open up App.tsx to start working on your app!' placeholder (App.tsx:7); both are compiled by tsc (`--listFiles`). README.md:35 'Create an account or log in if you already have one.', :60 'Backend: Node.js with Express', :64 'Authentication: Firebase Authentication', :79 'see the LICENSE.md file' (`ls LICENSE*` -> none). prompt.txt:6-19 prescribes React Navigation, React Query/Zustand and /src/screens, /src/navigation — none used.

**What goes wrong:** A new contributor (or agent) builds against the README/prompt architecture, or edits App.tsx expecting it to be the app root and sees no effect.

**Suggested fix:** Delete App.tsx, index.ts and prompt.txt; rewrite README to the actual stack (expo-router, SQLite-local, no accounts) and either add the license file or drop the claim.

### A119. [LOW · code-quality] Dead code and duplicate route files: unused PlaceholderScreen, SCALE_LABELS, settings `cs`, several unused styles, and two empty `/add` route files
**Where:** `app/(tabs)/add.tsx:4`  ·  **Verifiers upholding:** 3/3

**What:** Dead code leftovers (unused PlaceholderScreen, SCALE_LABELS, settings `cs`, six unused StyleSheet entries) plus two placeholder `/add` route files that render an empty View; the tab's real action lives in AddTabButton (`app/(tabs)/_layout.tsx:91`), so the `tinnitus-app://add` deep link opens a blank screen.

**Evidence:** PlaceholderScreen.tsx has no importers (grep) and hard-codes "Content coming soon." at :13 using the static light-only `colors` (:2). IntensityIcon.tsx:23-32 `SCALE_LABELS` is unused and duplicates `iconStyle.scaleLabels` in en.json:371-380. settings.tsx:66 `const cs = ...` is never called in that file. Unused styles: trends.tsx:2164-2175 distBadge/distBadgeText, calendar.tsx:530-536 intensityCircle and :589-600 intensityCircleNum/todayRing, new.tsx:569-576 tooltipBox/tooltipText. app/add.tsx:1-5 and app/(tabs)/add.tsx:1-5 both export an empty `<View style={{ flex: 1 }} />` for the same `/add` path, and app.json:5 registers the `tinnitus-app` scheme.

**What goes wrong:** Opening `tinnitus-app://add` (or any future `router.push('/add')`) shows a blank page with only the tab bar, because the Add tab's real action lives in the custom tab button, not the route.

**Suggested fix:** Delete PlaceholderScreen, SCALE_LABELS, the stray `cs`, the unused styles and app/add.tsx; make app/(tabs)/add.tsx a `<Redirect href="/entry/new" />` so the route is never blank.

### A120. [LOW · code-quality] Future-day toast timer is never assigned, and rapid taps overlap two Animated sequences; month navigation also double-fetches entries
**Where:** `app/(tabs)/calendar.tsx:134`  ·  **Verifiers upholding:** 3/3

**What:** `toastTimer` is declared and cleared but never assigned (dead guard), so rapid future-day taps overlap two `Animated.sequence`s and the first one's fade-out cuts the second toast short; `prevMonth`/`nextMonth` (and the focus callback's reset branch) call `getEntriesForMonth` directly and again via the `[monthKey]` effect, running the same SELECT twice per month change.

**Evidence:** calendar.tsx:113 `const toastTimer = useRef(...)`, :135 `if (toastTimer.current) clearTimeout(toastTimer.current);` — no assignment anywhere in the file. :136-140 `Animated.sequence([...]).start()` with no reference kept and no `.stop()`. :207 and :216 `setEntries(getEntriesForMonth(prev...))` plus :176-178 `useEffect(() => { setEntries(getEntriesForMonth(currentMonth...)); }, [monthKey]);`.

**What goes wrong:** User taps two future days 1 s apart: sequence 1's final `timing(toValue: 0)` fires ~1.8 s after the first tap and hides the toast while sequence 2 is still in its hold, so the second toast disappears after ~0.8 s. Each month arrow press runs the same SELECT twice.

**Suggested fix:** Store the composite animation in a ref and `.stop()` it before restarting (drop `toastTimer`); remove the direct `setEntries` calls in `prevMonth`/`nextMonth` and let the `[monthKey]` effect own the reload.

### A121. [LOW · code-quality] Dead sort option, unused styles, and a ghost render that runs the temporal fit and mounts an InfoModal twice per open panel
**Where:** `app/(tabs)/trends.tsx:470`  ·  **Verifiers upholding:** 3/3

**What:** Hidden 'longest' sort is dead code: `longestWith` is hard-coded to 0 (l.470) so the l.485-487 sort branch and l.506 `subMeta` ("longest 0") can never work, even though fitTemporalProfile already computes the real streak; styles `corrVerdictWarn`/`distBadge`/`distBadgeText` (l.1939, 2164, 2171) are unreferenced; and `CollapsiblePanel` (l.254-260) renders its children twice (ghost for measurement + visible), so every open trigger panel mounts two `CorrelationPanel` instances, each running `fitTemporalProfile` and mounting an `InfoModal`. No user-visible impact today (chip hidden, fit is sub-millisecond); cleanup/code-quality only.

**Evidence:** l.414 `{ key: 'longest', ..., hidden: true }`, l.470 `longestWith: 0,`, l.485-487 sort branch and l.506 subMeta that can only ever print 'longest 0'. Styles `corrVerdictWarn` (l.1939), `distBadge` (l.2164), `distBadgeText` (l.2171) have zero `ss.` references. CollapsiblePanel l.254-260 renders `{children}` in a zero-opacity ghost and again visibly, so each CorrelationPanel instance runs `fitTemporalProfile` (l.271-274) twice and mounts two InfoModal (l.356-361) components, one inside a `pointerEvents="none"` view.

**What goes wrong:** A developer un-hides the 'Longest streak' chip expecting it to work and gets every row showing 'longest 0'; opening several trigger panels doubles the temporal refits and Modal mounts for no visible benefit.

**Suggested fix:** Delete the 'longest' option, `longestWith`, the sort branch and `subMeta` (or wire longestWith from fitTemporalProfile if it is wanted); remove the three unused styles; measure the panel height with a single render (onLayout on the inner Animated.View with height:auto, or measure once and cache) instead of a ghost copy.

### A122. [LOW · code-quality] handleSave leaves `saving` stuck true if authenticate() rejects
**Where:** `app/app-lock.tsx:43`  ·  **Verifiers upholding:** 3/3

**What:** handleSave awaits appLock.authenticate() without try/finally; a rejected authenticateAsync promise skips setSaving(false), leaving the Save button disabled for the rest of the screen visit with no user feedback or recordError.

**Evidence:** app/app-lock.tsx:42-45 `setSaving(true); const result = await appLock.authenticate(t('lock.prompt')); setSaving(false); if (!result.success) return;` — `LocalAuthentication.authenticateAsync` (app/utils/appLock.ts:29) can reject with a native error; Save is disabled while `saving` (app/app-lock.tsx:94).

**What goes wrong:** User selects On, taps Save, the native auth call throws (module error, interrupted prompt) → `saving` stays true → Save stays disabled; the user must leave and re-enter the screen, with no message about what happened.

**Suggested fix:** Wrap in try/finally (`finally { setSaving(false); }`) and `recordError` the failure; optionally show StatusDialog with lock.failed.

### A123. [LOW · code-quality] Dead component with hard-coded English and ten unreferenced translation keys
**Where:** `app/components/PlaceholderScreen.tsx:13`  ·  **Verifiers upholding:** 3/3

**What:** `PlaceholderScreen` is unreferenced and renders a hard-coded English string; ten en.json keys (common.edit/today/yesterday, stats.topTriggers, localSupport.search/international/countries/notFoundBody, entryForm.durationConstantSub/durationEpisodicSub) are present in all 28 locales but never read by any t() call, literal or templated. CLAUDE.md's note that PlaceholderScreen is used by Stats/Calendar/More is also stale.

**Evidence:** app/components/PlaceholderScreen.tsx:13 `<Text style={styles.subtitle}>Content coming soon.</Text>`; `grep -rn PlaceholderScreen app` returns only the file itself. Unreferenced keys (literal and `labelKey`/template references both checked): `common.edit`, `common.today`, `common.yesterday` (en.json:6-8), `stats.topTriggers` (:60), `localSupport.search` (:186), `localSupport.international` (:187), `localSupport.countries` (:193), `localSupport.notFoundBody` (:196), `entryForm.durationConstantSub` (:319), `entryForm.durationEpisodicSub` (:321).

**What goes wrong:** Translators maintain strings nobody sees; if PlaceholderScreen is reused it ships English in every language.

**Suggested fix:** Delete PlaceholderScreen (or translate it) and prune the ten keys from all locale files with a script.

### A124. [LOW · code-quality] Intensity is 0–5 in code but documented as 1–5, with no DB constraint
**Where:** `app/db/database.ts:30`  ·  **Verifiers upholding:** 3/3

**What:** Intensity is a 0–5 scale in code (six pickers/labels/colours, '0 · None' tooltip) but CLAUDE.md:30/42 and app/stats/sevenDayTrend.ts:334-336 document it as 1–5 (sevenDayTrend.ts:344 even says 0–5 a few lines later); the entries.intensity column has no CHECK and saveEntry/updateEntry/importEntries (queries.ts:339) never validate the range.

**Evidence:** database.ts:30 `intensity INTEGER NOT NULL` (no CHECK). app/constants/theme.ts:1-2 six `SCALE_COLORS`/`INTENSITY_LABELS` incl. 'None'; app/entry/new.tsx:62 and app/entry/[id].tsx:56 `Array.from({ length: 6 })`; reportData.ts:84 `length: 6`; en.json `entryForm.tooltips.intensity` lists '0 · None'. Contradicted by CLAUDE.md 'intensity (required, 1–5)' and app/stats/sevenDayTrend.ts:334-336 'on the 1-5 scale ... intensity is always >= 1'. I checked the consumers of level 0 (trends.tsx:90, calendar.tsx:301-304 `Math.max`, IntensityIcon.tsx:45 clamp, theme.ts:4-5 clamp) and they handle 0 correctly today.

**What goes wrong:** No runtime failure today; the risk is a future change (or an import, see the validation finding) relying on the documented 1–5 range — e.g. treating `intensity` as truthy to mean 'logged' would drop every 'None' day.

**Suggested fix:** Update CLAUDE.md and the sevenDayTrend.ts comment to 0–5; add `CHECK (intensity BETWEEN 0 AND 5)` to the CREATE TABLE for new installs and validate the range in `saveEntry`/`updateEntry`/`importEntries` for existing ones.

### A125. [LOW · code-quality] Dead state, unused imports and unused styles in both entry forms
**Where:** `app/entry/new.tsx:257`  ·  **Verifiers upholding:** 3/3

**What:** Dead `intensityError` state (set at new.tsx:309/414 and [id].tsx:255/387, never read), unused `Easing`/`LayoutAnimation` imports plus an orphaned `UIManager.setLayoutAnimationEnabledExperimental` call (new.tsx:4-5, 27-28), and unreferenced styles `tooltipBox`/`tooltipText` (new.tsx:569-576) and `scaleValue` ([id].tsx:580); tsconfig lacks `noUnusedLocals` so tsc does not catch any of it.

**Evidence:** app/entry/new.tsx:257 and app/entry/[id].tsx:173 declare `intensityError`; it is only set (new.tsx:309, 414; [id].tsx:255, 387) and never appears in JSX. new.tsx:4-5 import `Easing` and `LayoutAnimation` (unused); new.tsx:27-29 call `UIManager.setLayoutAnimationEnabledExperimental` with no LayoutAnimation usage. Styles `tooltipBox`/`tooltipText` (new.tsx:569-576) and `scaleValue` ([id].tsx:580) are unreferenced. `npx tsc --noEmit` passes because tsconfig does not enable noUnusedLocals.

**What goes wrong:** The shake animation is the only validation feedback; readers assume intensityError drives a visible error state that does not exist. The dead code also inflates the already duplicated files.

**Suggested fix:** Either render an error style driven by intensityError or remove it; drop the unused imports, the UIManager call and the orphaned styles. Consider enabling `noUnusedLocals` in tsconfig.

### A126. [LOW · code-quality] Automatic first-day-of-week resolution is duplicated in the settings screen
**Where:** `app/first-day-of-week.tsx:34`  ·  **Verifiers upholding:** 3/3

**What:** `automaticSubtitle()` re-implements the context's private `resolveAutomaticFirstDay()` (same `firstWeekday - 1`, Monday fallback) instead of reusing it, so the Settings subtitle and the calendar grid can diverge if only one copy is changed.

**Evidence:** FirstDayOfWeekContext.tsx:17-20 `function resolveAutomaticFirstDay() { const weekday = Localization.getCalendars()[0]?.firstWeekday; return weekday ? weekday - 1 : 1; }` and first-day-of-week.tsx:33-36 `const weekday = Localization.getCalendars()[0]?.firstWeekday; const jsDay = weekday ? weekday - 1 : 1;`.

**What goes wrong:** A future change to the fallback (e.g. Sunday for en-US) made in one file only would show "Automatic (Sunday)" in Settings while the calendar grid still starts on Monday.

**Suggested fix:** Export `resolveAutomaticFirstDay` from the context module and import it in `app/first-day-of-week.tsx`.

### A127. [LOW · code-quality] `Animated.event` and the interpolation nodes are rebuilt on every render of the host screen
**Where:** `app/hooks/useHeaderScrollAnim.ts:14`  ·  **Verifiers upholding:** 3/3

**What:** `Animated.event` (line 14) and the three `scrollY.interpolate` nodes (lines 19, 24, 34) are rebuilt on every render of the host screen (Home, Calendar, More, Stats) with no useMemo/useRef, re-attaching the native scroll listener and recreating the interpolation node graph each time; harmless today since none of those screens re-renders per scroll frame, but trivially fixed by memoizing on `scrollY`.

**Evidence:** useHeaderScrollAnim.ts:14-17 `const onScroll = Animated.event([...], { useNativeDriver: true });` and :19-38 `scrollY.interpolate(...)` x3, all at hook top level with no `useMemo`/`useRef`. Home re-renders on every focus (index.tsx:89-94) and on every `entries`/`trendView` change.

**What goes wrong:** No visible bug today; it is wasted native attach/detach work per re-render and a new node graph per render, which becomes measurable if a screen using this hook ever re-renders per scroll frame (e.g. a JS-side `onScroll` state like entry/new.tsx:408 does).

**Suggested fix:** Wrap `onScroll` and the three interpolations in `useMemo(() => ..., [scrollY])` (or build them once in the same `useRef` initializer as `scrollY`).

### A128. [LOW · code-quality] `.map(t => …)` shadows the i18n `t` on the same line that calls `triggerLabel(t, …)`
**Where:** `app/triggers.tsx:43`  ·  **Verifiers upholding:** 3/3

**What:** `.map(t => …)` on app/triggers.tsx:43 and app/sound-types.tsx:43 shadows the i18n `t` from `useTranslation()` (line 35) inside the map body; currently harmless because the `triggerLabel(t, …)`/`soundTypeLabel(t, …)` closure is created before `.map`, but any future use of `t` inside the callback would get a DB row instead of the translate function. Rename the parameter (e.g. `row`) in both screens.

**Evidence:** app/triggers.tsx:43 `sortByLabel(getTriggersForManagement(), x => triggerLabel(t, x.name), i18n.language).map(t => ({ id: t.id, ...` and identical app/sound-types.tsx:43 with `soundTypeLabel`.

**What goes wrong:** A refactor that moves `triggerLabel(t, …)` inside the `.map` callback (e.g. to precompute a `label` field) would pass a DB row as the translate function and crash at first render with 't is not a function' — the type of the parameter changes silently.

**Suggested fix:** Rename the map parameter (`row`) in both screens.

### A129. [LOW · code-quality] Deprecated `expo-router/babel` plugin still configured; warns on every bundle
**Where:** `babel.config.js:5`  ·  **Verifiers upholding:** 3/3

**What:** `plugins: ['expo-router/babel']` points at a deprecation stub (expo-router 55.0.12 babel.js) that only prints a console.warn; the router transform is already applied by babel-preset-expo 55.0.17. Remove the plugins entry and restart Metro with a cleared cache.

**Evidence:** babel.config.js:5 `plugins: ['expo-router/babel']`; node_modules/expo-router/babel.js:11-13 `console.warn('expo-router/babel is deprecated in favor of babel-preset-expo in SDK 50. To fix the issue, remove "expo-router/babel" from "plugins" in your babel.config.js file.')`.

**What goes wrong:** Every Metro start prints the warning, training developers to ignore console warnings; the extra plugin pass runs for nothing.

**Suggested fix:** Delete the `plugins` line and clear the Metro cache (`expo start -c`).

### A130. [LOW · code-quality] metro.config.js carries a no-op condition override with a false comment plus a stub for an unused dependency
**Where:** `metro.config.js:9`  ·  **Verifiers upholding:** 3/3

**What:** `unstable_conditionNames = ['default']` is a no-op on the installed Metro 0.83.5 (matchSubpathFromExportsLike.js:16-17 always includes "default"), so the comment at lines 5-8 is false; the `./PieChart/pro` stub at lines 11-16 only serves react-native-gifted-charts, which has zero import sites in app/, src/ or tests/ and is already slated for removal in the CLAUDE.md backlog.

**Evidence:** metro.config.js:5-9 comment claims Metro 'only honors the "default" exports condition if it's explicitly listed here'; node_modules/metro-resolver/src/utils/matchSubpathFromExportsLike.js:16-23 builds `new Set(["default", isESMImport ? "import" : "require", ...context.unstable_conditionNames, ...conditionsByPlatform])` — 'default' is unconditional, and Expo does not set unstable_conditionNames (grep of @expo/metro-config/build -> none; metro-config default is `[]`). metro.config.js:11-16 stubs './PieChart/pro'; package.json:41 react-native-gifted-charts has 0 import sites in app/, src/, tests/.

**What goes wrong:** Future readers keep the line (or copy the pattern) believing it fixes resolution; the gifted-charts stub keeps a resolveRequest hook on every module resolution for a package that ships nothing.

**Suggested fix:** Delete both blocks, uninstall react-native-gifted-charts, and re-verify the react-i18next/@babel/runtime resolution that motivated the comment (it resolves via the built-in 'default' match).

### A131. [LOW · code-quality] Unused dependencies, dead template files, empty routes and a deprecated Babel plugin
**Where:** `package.json:41`  ·  **Verifiers upholding:** 3/3

**What:** Dead weight: react-native-gifted-charts (plus the metro `./PieChart/pro` stub) and @expo/vector-icons are installed but unused; App.tsx/index.ts are unreachable template entry points (main is expo-router/entry); app/add.tsx is an empty but routable `/add` screen (app/(tabs)/add.tsx is a required tab stub and is fine); PlaceholderScreen.tsx is unimported; babel.config.js:5 loads the deprecated no-op `expo-router/babel` which warns on every bundle; pulldb.sh targets the Expo Go package path; entry/new.tsx enables LayoutAnimation it never calls; @react-native-community/cli is pinned to "latest".

**Evidence:** package.json:12 `@expo/vector-icons`, :41 `react-native-gifted-charts` -> `grep -rn 'vector-icons|gifted-charts' app src` empty; metro.config.js:11-16 stub for `./PieChart/pro`. package.json:4 `"main": "expo-router/entry"` makes App.tsx:1-20 and index.ts:1-8 unreachable. app/add.tsx:3-5 and app/(tabs)/add.tsx:3-5 render `<View style={{ flex: 1 }} />` (so `/add` is a blank navigable route). PlaceholderScreen.tsx has no importers; theme.ts:63-74 static `colors` used only there and in onboarding. babel.config.js:5 `plugins: ['expo-router/babel']` -> node_modules/expo-router/babel.js:11 'expo-router/babel is deprecated ... remove'. pulldb.sh:4 `host.exp.exponent` (Expo Go path; app needs a dev client). entry/new.tsx:5,27-29 imports LayoutAnimation and calls setLayoutAnimationEnabledExperimental, no LayoutAnimation usage. package.json:47 `"@react-native-community/cli": "latest"` unpinned.

**What goes wrong:** Every build prints the deprecation warning; bundle and install size carry two chart/icon libraries; `/add` can be reached by deep link and shows a blank screen; a future `npm install` can pull a different CLI major because of 'latest'.

**Suggested fix:** `npm uninstall react-native-gifted-charts @expo/vector-icons`, delete the metro resolver, App.tsx, index.ts, app/add.tsx, PlaceholderScreen.tsx, the static `colors` export (migrate onboarding to lightColors), pulldb.sh/prompt.txt; remove `expo-router/babel`; pin the CLI version; drop the LayoutAnimation import.

### A132. [LOW · code-quality] Dependency hygiene: floating `latest` CLI tag, two unused packages, and a broken `web` script
**Where:** `package.json:47`  ·  **Verifiers upholding:** 3/3

**What:** `@react-native-community/cli` is pinned to the floating `latest` tag (lockfile: 20.1.3, not a declared dep of react-native or expo); `react-native-gifted-charts` (:41) and `@expo/vector-icons` (:12) are never imported yet gifted-charts still justifies the `./PieChart/pro` stub in metro.config.js; `react-dom` (:38) and the `web` script (:9) exist without `react-native-web` installed.

**Evidence:** package.json:47 `"@react-native-community/cli": "latest"` (lockfile resolves 20.1.3; RN 0.83 pairs with CLI 20.x). package.json:41 react-native-gifted-charts and :12 @expo/vector-icons -> 0 import sites (grep of app/, src/, tests/, plugins/); CLAUDE.md backlog acknowledges both. package.json:9 `"web": "expo start --web"`, :38 react-dom; `ls node_modules/react-native-web` -> not installed. All expo-* packages match the SDK 55 bundledNativeModules ranges (checked), so there is no version mismatch.

**What goes wrong:** A lockfile regeneration (`npm install` after a merge conflict, `npm update`) pulls a newer major CLI incompatible with RN 0.83 and breaks `expo run:android`; `npm run web` fails immediately; gifted-charts and vector-icons add install time, transitive deps and the metro stub for no benefit.

**Suggested fix:** Pin the CLI to `^20.1.3` (or drop it if `expo run:android` works without it), remove react-native-gifted-charts, @expo/vector-icons, react-dom and the `web` script.

### A133. [LOW · code-quality] Stale committed artefacts: pulldb.sh targets Expo Go's data dir, prompt.txt is an unrelated scaffold prompt, App.tsx/index.ts are the unused template entry
**Where:** `pulldb.sh:4`  ·  **Verifiers upholding:** 3/3

**What:** Stale committed artefacts: pulldb.sh targets Expo Go's data dir (host.exp.exponent) instead of tech.kappsa.tinnitustracker and needs adb root; App.tsx/index.ts are the unused template entry (main is expo-router/entry); prompt.txt is an unrelated scaffold prompt. No runtime impact.

**Evidence:** pulldb.sh:4 `adb shell cp /data/user/0/host.exp.exponent/files/SQLite/tinnitus.db ...` (Expo Go package) while app.json:26 builds `tech.kappsa.tinnitustracker` as a dev client/standalone app, and :2 `adb root` only works on emulators/rooted devices. prompt.txt is a generic 'React Navigation + React Query + Zustand' scaffolding prompt unrelated to this expo-router/SQLite codebase. App.tsx renders 'Open up App.tsx to start working on your app!' and index.ts registers it, but package.json `"main": "expo-router/entry"` means neither is ever loaded. google-services.json holds only the Firebase Android app id/API key (public client config, also embedded in every APK); purchases.ts:6 is RevenueCat's public SDK key; firebase.json `crashlytics_debug_enabled` only affects debug builds and crashlytics.ts:16 disables collection in __DEV__ anyway.

**What goes wrong:** A contributor runs pulldb.sh expecting the app DB and gets 'No such file' or a different app's DB; prompt.txt and App.tsx mislead newcomers about the architecture. No runtime impact.

**Suggested fix:** Delete prompt.txt, App.tsx and index.ts; either fix pulldb.sh to `adb exec-out run-as tech.kappsa.tinnitustracker cat databases/tinnitus.db > tinnitus.db` (works on debug builds without root) or move it to docs/. Leave google-services.json, the RevenueCat key and firebase.json as they are; optionally restrict the Firebase Android API key to the package + signing SHA-1 in the Google Cloud console.

### A134. [LOW · code-quality] withEnglishMetadata throws at module-evaluation time and only guards one direction of drift
**Where:** `src/features/learn/content.ts:92`  ·  **Verifiers upholding:** 3/3

**What:** withEnglishMetadata (lines 89-95) throws from module scope (invoked at lines 100/166/232) when a translated slug has no English counterpart, so a slug typo in one locale fails module evaluation for the Learn routes at app startup instead of degrading gracefully; the reverse drift (English article missing from a locale) is not detected or back-filled, leaving es/fr/de users with a shorter list and 'learn.notFound' for that slug. All four locales currently match (7 identical slugs), so this is latent, not an active bug.

**Evidence:** content.ts:89-95 — `function withEnglishMetadata(copy) { return copy.map(article => { const source = en.find(item => item.slug === article.slug); if (!source) throw new Error(`Missing English Learn article: ${article.slug}`); … }) }` executed at module scope by `const es = withEnglishMetadata([...])` (line 100), `fr` (166), `de` (232). No check that `copy.length === en.length` or that every English slug is present in each translation; there is no test runner (package.json has no test script) so this is never exercised before runtime.

**What goes wrong:** A future edit renames an English slug (e.g. 'medicines' → 'medications') but not the Spanish one: the throw fires during route-module loading and the whole app fails to start, not just the Learn screen. Conversely, if the next article is added to `en` only, Spanish/French/German users silently get one guide fewer and `learn.updated`/the review package never notice.

**Suggested fix:** Make the mismatch a dev-only warning plus fallback to the English article (so a content typo can't take the app down), add the reverse check (every English slug present in each locale, falling back to the English article when missing), and cover it with the existing tests/ folder once a runner exists.

### A135. [LOW · code-quality] `LEARN_CONTENT_UPDATED` is unused and the hard-coded 'Content updated August 2026' footer is already stale
**Where:** `src/features/learn/content.ts:303`  ·  **Verifiers upholding:** 3/3

**What:** `LEARN_CONTENT_UPDATED` ('2026-08-24') has no importers; the Learn index footer (`app/learn/index.tsx:75` → `learn.updated`, `en.json:299`) is a hard-coded "Content updated August 2026" string that was not bumped when commit 9f0b75c added the medicines guide on 2026-10-04, so the displayed date is already stale and will drift further with every guide edit across 28 locales.

**Evidence:** src/features/learn/content.ts:303 `export const LEARN_CONTENT_UPDATED = '2026-08-24';` — grep shows no importer. app/learn/index.tsx:75 `t('learn.updated')`; en.json `learn.updated`: 'Content updated August 2026 · Clinical review required before release'. CLAUDE.md (session 2026-10-04) records the 'Medicines and tinnitus' guide as newly added.

**What goes wrong:** Learn index tells the user the content was last updated in August while the medicines guide (content.ts:67-75) was added in October; every future guide edit requires remembering to touch 28 locale strings.

**Suggested fix:** Interpolate `LEARN_CONTENT_UPDATED` (formatted with `Intl.DateTimeFormat`) into `learn.updated`, and bump the constant when guides change.

### A136. [LOW · design-decision] iPad support is declared (including landscape) while every layout is phone-width with no maximum content width
**Where:** `app.json:11`  ·  **Verifiers upholding:** 3/3

**What:** `ios.supportsTablet: true` (with `orientation: "portrait"` only applying to iPhone — Info.plist adds Landscape for ~ipad and UIRequiresFullScreen=false) opts into iPad/landscape/Split View, but no screen caps content width (no `maxWidth` anywhere): app/(tabs)/calendar.tsx:76-77, app/components/charts/IntensityTrendChart.tsx:139,289, app/(tabs)/trends.tsx:1263 and app/onboarding/index.tsx:55,169-172 all size from the full window width, so on a 1024-1366pt iPad the calendar cells, charts and onboarding art stretch edge to edge.

**Evidence:** app.json:11 `"supportsTablet": true` (generated Info.plist:81-87 lists Portrait/Landscape for ~ipad, UIRequiresFullScreen false). grep `maxWidth` in app/ → no matches. calendar.tsx:76-77 `cellWidth = Math.floor((screenWidth - CONTENT_H_PAD * 2) / 7); const cellHeight = 60;`. IntensityTrendChart.tsx:139,289 `chartWidth = screenWidth - 68 - ...`. onboarding/index.tsx:55 `illustrationHeight = height * 0.4` and :169-172 `illustrationImage: { width: '100%', height: '100%' }`.

**What goes wrong:** 12.9" iPad in landscape (1366pt wide): calendar cells become ~190×60pt slabs with a 40pt icon floating in each, the 7-day bar chart stretches to ~1250pt with 65%-width bars, Home cards run edge to edge, and onboarding slides scale a phone illustration to full width.

**Suggested fix:** Either set `supportsTablet: false` until a tablet layout exists, or wrap screen content in a centered container with `maxWidth: 600` and derive chart/calendar widths from that container (useWindowDimensions → min(width, 600)).

### A137. [LOW · design-decision] Calendar cells encode a day's maximum intensity while every chart encodes the day's mean
**Where:** `app/(tabs)/calendar.tsx:301`  ·  **Verifiers upholding:** 3/3

**What:** Calendar day cells encode the day's maximum intensity (calendar.tsx:301-317) while the Home/Stats charts encode the day's mean (sevenDayTrend.ts:276-279, index.tsx:196/216); nothing in the UI or i18n strings tells the user the two summaries differ.

**Evidence:** calendar.tsx:301-304 `const maxIntensity = hasEntries ? Math.max(...dayEntries.map(e => e.intensity)) : null; const entryColor = ... intensityColor(maxIntensity)` rendered via `IntensityIcon level={maxIntensity}` (line 317). sevenDayTrend.ts:276-281 `getBuckets` -> `value: avgOrNull(items.map(e => e.intensity))`.

**What goes wrong:** Tuesday has four entries: 1, 1, 1, 5. Calendar shows a red "Severe" face for Tuesday; the Home weekly chart shows Tuesday as 2.0 (lime). The user cannot tell which one "Tuesday" was.

**Suggested fix:** Either switch the cell to the day's mean (consistent with the charts) or keep max but say so (e.g. a small "peak" caption in the detail header). Document the choice in CLAUDE.md either way.

### A138. [LOW · design-decision] `impact` is declared INTEGER but holds a TEXT enum; legacy integer rows survive every reader invisibly
**Where:** `app/db/database.ts:34`  ·  **Verifiers upholding:** 3/3

**What:** `entries.impact` is declared INTEGER but the app writes/reads the string enum manageable|bothersome|distressing (types.ts:51); no migration or CHECK exists, so a legacy numeric value (dev-era seed or an imported backup — importEntries at queries.ts:345 inserts impact unvalidated, and INTEGER affinity coerces "3" to 3) is hidden by display paths (ExpandableEntryRow.tsx:155 '—', trends.tsx:923 excluded) yet counted as a detailed check-in (evaluate.ts:142) and silently re-persisted by the edit screen ([id].tsx:199 → updateEntry). Dormant hazard only: no store/EAS build (eas.json from 2026-05-21) predates the enum change (bc8d47e, 2026-05-17).

**Evidence:** app/db/database.ts:34 `impact     INTEGER,` vs app/db/types.ts:51 `impact: Distress | null;`. Commit bc8d47e (2026-05-17, "change distress from 1-5 scale to manageable/bothersome/distressing") changed only types/queries/seed/UI — database.ts diff touches only seedDevData. Readers today: app/components/ExpandableEntryRow.tsx:155 `const distressValid = entry.impact === 'manageable' || ...` renders '—' for a number; app/(tabs)/trends.tsx:923 `if (val !== null && counts.has(val))` drops it from the Distress card; but app/entry/[id].tsx:199 `setImpact(entry.impact)` feeds the number into `SegmentedControl` ([id].tsx:105 `value === opt.value` never matches) and Save writes it back via updateEntry; src/features/achievements/evaluate.ts:142 counts `e.impact !== null` as a detailed check-in; app/my-data.tsx:147 exports `impact: e.impact` raw and app/db/queries.ts:345 re-inserts `e.impact ?? null` with no type check. Git grounding: the numeric-impact entry form existed only between f1b5183 (2026-04-29) and bc8d47e (2026-05-17); eas.json first appeared at f8ba705 (2026-05-21) and the 1.0.1 bump at c30bf6d (2026-05-24), both after the enum change, and `android/` is untracked — so no store/EAS build ever wrote integer impact.

**What goes wrong:** A dev-era database (or a backup exported from one) has a row with impact=3. Home/Calendar show Distress '—', Stats Distress card excludes it from its total, yet Milestones counts the entry as 'detailed' and opening it in the edit screen shows no distress selected while Save silently persists 3 again; a backup carrying `"impact": "3"` is coerced to INTEGER 3 by the column's affinity on import. Because this shape never shipped in a store build this is a schema/type mismatch with dormant hazard, not user data loss.

**Suggested fix:** Either migrate in initDatabase (`UPDATE entries SET impact = CASE impact WHEN 1 THEN 'manageable' WHEN 2 THEN 'manageable' WHEN 3 THEN 'bothersome' WHEN 4 THEN 'distressing' WHEN 5 THEN 'distressing' END WHERE typeof(impact)='integer'`, or NULL them) and document the column as TEXT, or at minimum have importEntries/updateEntry reject non-enum values so the mismatch cannot be re-introduced. Add a CHECK on new installs.

### A139. [LOW · design-decision] 'Delete All Data' also erases event-based milestones that the diary cannot reconstruct
**Where:** `app/db/queries.ts:399`  ·  **Verifiers upholding:** 3/3

**What:** `deleteAllEntries()` runs an unfiltered `DELETE FROM achievements`, so the event-only milestones `first_report` and `first_guide` (recorded via `unlockEvent()` in app/reports.tsx:48 and app/learn/[slug].tsx:23, and evaluated solely from the stored row at evaluate.ts:149) are erased too, while the confirm dialog (en.json `myData.deleteAllMessage`, my-data.tsx:310) promises only to delete logged entries. Metric-based milestones are recomputed from the diary so deleting them is fine; either restrict the delete to non-event keys or mention milestones in the dialog.

**Evidence:** app/db/queries.ts:395-400 `deleteAllEntries() { ... db.runSync('DELETE FROM achievements'); }`. src/features/achievements/evaluate.ts:12-13: 'event-based: recorded at the moment the thing happens ... the diary cannot reconstruct them.' en.json `myData.deleteAllDataSubtitle`: 'Permanently erase all logged entries'; `myData.deleteAllMessage`: 'This permanently deletes all {{count}} logged entries'.

**What goes wrong:** User who has read a guide and shared a report wipes their diary to start fresh; 'Curious mind' and 'Ready for the appointment' are gone and cannot be re-earned without repeating the actions, although nothing in the dialog mentioned milestones.

**Suggested fix:** Either delete only metric-based achievement keys, or state in the confirm dialog that milestones are reset too.

### A140. [LOW · design-decision] Back-dated entries get the current wall-clock time, and today's entries can be timestamped in the future
**Where:** `app/entry/new.tsx:243`  ·  **Verifiers upholding:** 3/3

**What:** entryTime is always initialised to the current wall-clock time even when Calendar supplies a past `date` param, so back-dated entries get an invented time of day; and because only the date picker has `maximumDate` (line 384) while the time picker (391-401) and handleSave (313-331) never bound `combined` against now, a same-day entry can be saved with a future timestamp. The edit screen (app/entry/[id].tsx:348/358) has the same unbounded time picker.

**Evidence:** app/entry/new.tsx:240-243: `entryDate` honours `dateParam` but `entryTime` is always `useState<Date>(new Date())`; lines 313-320 combine them. `maximumDate={new Date()}` is set only on the date picker (line 384); the time picker (391-401) has no bound and handleSave never compares `combined` to now.

**What goes wrong:** At 09:14 the user logs yesterday from Calendar → entry saved at yesterday 09:14 and shown as '9:14 AM' on the calendar though they never chose a time. Alternatively, today + time 23:00 chosen at 10:00 → entry stored 13 hours in the future, listed as today's latest entry.

**Suggested fix:** For back-dated entries, either default the time to a neutral value or visually highlight the time row as 'not set'; clamp or reject `combined > new Date()` in handleSave with a small inline message.

### A141. [LOW · design-decision] Onboarding requires a name before the app can be used, though the name only personalises the greeting
**Where:** `app/onboarding/name.tsx:61`  ·  **Verifiers upholding:** 3/3

**What:** The onboarding name step has no Skip action (footer at lines 61-72 renders only the Continue CTA, which is disabled until `name.trim().length > 0` at line 18), even though the only consumers of `settings.name` (app/(tabs)/index.tsx:97, app/profile.tsx:49) already handle a missing value and the slides screen (onboarding/index.tsx:125-128) already has a Skip pattern to reuse.

**Evidence:** name.tsx:18 `const valid = name.trim().length > 0;`, :20-21 `function handleContinue() { if (!valid) return;`, :62-71 CTA rendered with `ctaWrapDisabled` and no alternative action. Consumer: app/(tabs)/index.tsx:87 `getSetting('name')` and :97 `const headline = userName ? `${greet}, ${userName}` : greet;`.

**What goes wrong:** A privacy-conscious user of a health diary (which also offers App Lock) must type a name to proceed; many will enter a throwaway string, which then appears in every greeting.

**Suggested fix:** Add a secondary "Skip" link (the slides screen already has the pattern at onboarding/index.tsx:125-128) and let Profile set the name later.

### A142. [LOW · design-decision] 'Coverage %' means two different things depending on the range toggle
**Where:** `src/features/reports/reportData.ts:89`  ·  **Verifiers upholding:** 3/3

**What:** 'Coverage %' uses a fixed 30/90-day denominator for 30D/90D (even when the diary is younger than the window) but the observed first-to-last span for ALL, so the same diary prints e.g. 6% on the default 90D report and 100% on ALL; the PDF label (reportHtml.ts:84) gives no hint which definition applied.

**Evidence:** src/features/reports/reportData.ts:89-91 `calendarDays = range === '30D' ? 30 : range === '90D' ? 90 : (last - first + 1)`; :101 `coverage: Math.round((byDay.size / calendarDays) * 100)`. tests/features.validation.ts:42 asserts the fixed-window behaviour is intended for 30D. The default range in app/reports.tsx:26 is '90D'.

**What goes wrong:** User installed 5 days ago and logged every day. Default 90D report prints 'Logged days 5 — 6% coverage', which a clinician reads as poor adherence; switching to 'All data' prints the same 5 days as '100% coverage'.

**Suggested fix:** Clamp the denominator to the days since the first entry (or since install) for 30D/90D, or label the metric explicitly ('5 of last 90 days') so the two definitions are not both called 'coverage'.

### A143. [LOW · i18n] No native per-app language declaration (locales_config.xml / CFBundleLocalizations)
**Where:** `app.json:42`  ·  **Verifiers upholding:** 3/3

**What:** `"expo-localization"` is listed without a `supportedLocales` option, so the config plugin emits neither Android `locales_config.xml`/`android:localeConfig` nor iOS `CFBundleLocalizations`; the OS per-app language settings (Android 13+, iOS) never list the app even though 28 locales ship and LanguageContext's 'automatic' mode would honour the OS choice.

**Evidence:** app.json:42 `"expo-localization",` (no options); `android/app/src/main/res/` has no `xml/` directory; `ios/*/Info.plist` contains `CFBundleDevelopmentRegion` but no `CFBundleLocalizations`.

**What goes wrong:** Android 13+: Settings > System > Languages > App languages does not list Tinnitus Tracker; iOS Settings shows no per-app Language entry — users must find the in-app picker.

**Suggested fix:** `["expo-localization", { "supportedLocales": { "ios": [28 tags], "android": [28 tags] } }]` and prebuild; low because the in-app picker already covers the need.

### A144. [LOW · i18n] Averages always use '.' as decimal separator
**Where:** `app/(tabs)/index.tsx:220`  ·  **Verifiers upholding:** 3/3

**What:** All user-visible decimal numbers (averages, deltas, chart labels, PDF metrics) are formatted with toFixed(1)/toFixed(0), so comma-decimal locales see an English decimal point; also at app/(tabs)/trends.tsx:176, :181, :1625, app/components/charts/IntensityTrendChart.tsx:250, app/reports.tsx:85, src/features/reports/reportHtml.ts:17 and :83.

**Evidence:** app/(tabs)/index.tsx:220 `{stats.avg.toFixed(1)} / 5`; app/(tabs)/trends.tsx:1625 same; app/reports.tsx:85 `data.average?.toFixed(1)`; src/features/reports/reportHtml.ts:83 and :17 `signed()` use `toFixed(1)` in the PDF.

**What goes wrong:** German user's Home shows "3.5 / 5" and the PDF "+1.2" where "3,5" / "+1,2" is expected.

**Suggested fix:** Format with a cached `Intl.NumberFormat(resolvedLanguage, { minimumFractionDigits: 1, maximumFractionDigits: 1 })` (NumberFormat is implemented in Hermes) via a helper in datetime.ts/number utils.

### A145. [LOW · i18n] Serbian ships Latin-script only and is auto-selected for Cyrillic-script devices
**Where:** `app/contexts/LanguageContext.tsx:58`  ·  **Verifiers upholding:** 3/3

**What:** Serbian is shipped Latin-script only (sr.json has no Cyrillic) and resolveAutomaticLanguage() matches on languageCode alone (line 58), so devices set to Serbian (Cyrillic) are auto-resolved to Latin text; the picker label 'Srpski' (line 31) does not disclose the script.

**Evidence:** app/contexts/LanguageContext.tsx:31 `sr: 'Srpski'`; app/i18n/locales/sr.json:3 `"cancel": "Otkaži"` (Latin); resolution at LanguageContext.tsx:47-61 uses only `languageCode`, while expo-localization exposes the script (LocalizationModule.kt:142 `"languageScriptCode" to locale.script`) and Android reports `sr` for both `sr-Cyrl-RS` and `sr-Latn-RS`.

**What goes wrong:** Device language "Српски (ћирилица)" → app renders "Otkaži", "Sačuvaj" in Latin script and labels the language "Srpski".

**Suggested fix:** Label the option "Srpski (latinica)" now; if Cyrillic is wanted later, add an `sr-Cyrl` file and branch on `languageScriptCode` in `resolveAutomaticLanguage`.

### A146. [LOW · i18n] Reminder notifications can be (re)scheduled in English at cold start and are never re-synced after a language change
**Where:** `app/contexts/LanguageContext.tsx:93`  ·  **Verifiers upholding:** 3/3

**What:** `setLanguage` (LanguageContext.tsx:93-96) never calls `syncReminderNotifications`, and the only other sync sites are the Reminders screen (reminders.tsx:53) and the cold-start sync (_layout.tsx:101); so after a language change, already-scheduled reminder notifications keep their old-language title/body until the Reminders screen is edited or a later cold start happens to run the sync after `LanguageProvider`'s `changeLanguage` effect. Additionally, because i18n is initialised with `lng: 'en'` (i18n/index.ts:74) and the real language is only applied in a post-mount effect, the cold-start sync's `t()` (evaluated after two native round trips) can race that effect and schedule reminders in English on slower devices.

**Evidence:** app/i18n/index.ts:74 `lng: 'en'` (saved/device language not consulted at init). app/contexts/LanguageContext.tsx:86-91 `useEffect(() => { i18n.changeLanguage(resolvedLanguage); ... }, [resolvedLanguage])` — runs only after providers mount, which happens after `setAppReady(true)` (app/_layout.tsx:105, :111). app/_layout.tsx:100-102 `hasNotificationPermission().then(granted => { if (granted) syncReminderNotifications(reminders, i18n.t.bind(i18n)); })` — `t()` is evaluated inside the sync after another native round trip (`await cancelAll...`, notifications.ts:117, then :124-125), so whichever finishes first — the permission/cancel round trips or the mount+effect — decides the language. `setLanguage` (LanguageContext.tsx:93-96) does not call syncReminderNotifications.

**What goes wrong:** Deterministic part: German user has the daily reminder on, switches Settings > Language from English to Deutsch → the 20:00 notification keeps the English title/body until they next touch the Reminders screen. Race part: on a slower device the startup sync's `t()` runs before LanguageProvider's `changeLanguage`, rewriting every reminder to English on each cold start even though the app UI is German. The same ordering also means the first painted frame after the splash hides (SafeAreaProvider onLayout, :114) can be in English before flipping.

**Suggested fix:** Resolve the language synchronously before the first render: read the saved `language` setting / `resolveAutomaticLanguage()` inside the startup effect and call `i18n.changeLanguage` before `setAppReady(true)` (or compute `lng` in app/i18n/index.ts from the setting). Then call `syncReminderNotifications(getReminders(), t)` (permission permitting) from the LanguageProvider effect or `setLanguage` so scheduled text follows the UI language.

### A147. [LOW · i18n] `reports.pdf.notEnoughImpact` is missing from de/es/fr, so one PDF paragraph falls back to English
**Where:** `app/i18n/locales/de.json:244`  ·  **Verifiers upholding:** 3/3

**What:** `reports.pdf.notEnoughImpact` (en.json:283, used at src/features/reports/reportHtml.ts:104 when no trigger estimates exist) is missing from de/es/fr, so under the translated "Zusammenhänge mit der Intensität" heading the PDF shows the English fallback sentence.

**Evidence:** Locale-parity script over app/i18n/locales/*.json: de, es and fr each miss exactly `reports.pdf.notEnoughImpact` (present in en.json:283). de.json:244 shows the surrounding `reports.pdf` block is translated. app/i18n/index.ts sets `fallbackLng: 'en'`. The remaining 24 locales have no `reports.*`, `achievements.*`, `learn.*` or `localSupport.*` keys at all (documented English fallback).

**What goes wrong:** German user with fewer than 8 logged days (or no varying triggers) creates a PDF: under 'Auslöser-Zusammenhänge mit der Intensität' the body reads 'There are not enough varying trigger days to estimate associations.'

**Suggested fix:** Add the key to de/es/fr and add a parity check for the `reports.pdf` block to tests/features.validation.ts.

### A148. [LOW · i18n] Section labels are shouted in the JSON for some screens and uppercased via style on others, forcing translators to choose casing
**Where:** `app/i18n/locales/en.json:147`  ·  **Verifiers upholding:** 3/3

**What:** Section/meta labels are uppercased inconsistently: More/Profile/My Data (more.tsx:381, profile.tsx:187, my-data.tsx:394) have no textTransform and rely on ALL-CAPS JSON strings; Settings (settings.tsx:226) stores sentence case and uppercases via style; Home tiles (index.tsx:424) and entry rows (ExpandableEntryRow.tsx:363) do both. Translators must choose casing per key, and locale files already contain hand-uppercased strings (de/tr), so uppercasing lives in two places.

**Evidence:** en.json:147 `"personalSection": "PERSONAL"`, :152 `"insightsSection": "INSIGHTS"`, :163,166, :54 `"avg": "AVERAGE INTENSITY"`, :599-605 entryRow.* all uppercase; versus :609-612 `"generalSection": "General"` rendered with settings.tsx:222-230 `textTransform: 'uppercase'`. index.tsx:420-428 applies textTransform on top of the already-uppercase stats.avg.

**What goes wrong:** A translator localises "AVERAGE INTENSITY" as all-caps German; the style then uppercases it again (no-op) while Settings' German label is uppercased by the OS with different ß handling, giving two casing conventions on adjacent screens.

**Suggested fix:** Store sentence case in all locale files and apply `textTransform: 'uppercase'` in the shared section-label style only.

### A149. [LOW · performance] Recent-entries list constructs a new Intl.DateTimeFormat for every row older than yesterday, on every focus
**Where:** `app/(tabs)/index.tsx:52`  ·  **Verifiers upholding:** 3/3

**What:** `formatEntryDate` constructs a fresh `Intl.DateTimeFormat` for each of up to 20 recent-entry rows older than yesterday on every HomeScreen render (including each tab focus, which replaces `entries`), unlike `formatDateKey`/`formatEntryTime` in app/utils/datetime.ts which cache formatters per timezone for exactly this reason.

**Evidence:** index.tsx:52-54 `const dateLabel = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: entry.timezone }).format(...)` inside `formatEntryDate`, called per row at line 266 for up to 20 rows. datetime.ts:40-43: "Constructing an Intl.DateTimeFormat costs roughly 20x what using one does... The formatter is therefore cached per timezone". The focus effect (index.tsx:89-94) replaces `entries` on every focus, re-rendering all rows.

**What goes wrong:** A user with 20+ entries older than yesterday pays ~18 formatter constructions on every return to the Home tab; on a low-end Android device this is the kind of per-row Intl cost the Stats profiling session already identified as the dominant one.

**Suggested fix:** Add a cached `formatEntryDateLabel(iso, timeZone)` to app/utils/datetime.ts keyed by timezone, mirroring `formatEntryTime`.

### A150. [LOW · performance] Screen-view analytics logs raw pathnames including entry ids, fragmenting screen names
**Where:** `app/_layout.tsx:58`  ·  **Verifiers upholding:** 3/3

**What:** logScreenView(pathname) sends the concrete path, so the dynamic route entry/[id] yields one screen_name per entry id (/entry/1 … /entry/N), fragmenting the edit screen's analytics; learn/[slug] is also dynamic but bounded. Log the route pattern (e.g. via useSegments()) or strip numeric segments instead.

**Evidence:** app/_layout.tsx:55-59 `const pathname = usePathname(); useEffect(() => { logScreenView(pathname); }, [pathname]);` and app/utils/analytics.ts:14-17 `logScreenViewNative(a, { screen_name: screenName, screen_class: screenName })`. Route `entry/[id]` is registered at app/_layout.tsx:74.

**What goes wrong:** After a few hundred entries across users, screen_name has values /entry/1 … /entry/N; Firebase Analytics reports for the edit screen split across hundreds of names and overflow into '(other)', making screen engagement for editing unmeasurable. (No health data leaks — the id is an autoincrement int — but the metric is useless.)

**Suggested fix:** Log the route pattern instead of the path: derive it from `useSegments()` (e.g. join segments, which keeps '[id]' literal) or strip numeric segments before calling logScreenView.

### A151. [LOW · performance] getAllEntriesWithRelations is O(entries x joinRows) and runs on every Save via syncAchievements
**Where:** `app/db/queries.ts:304`  ·  **Verifiers upholding:** 3/3

**What:** getAllEntriesWithRelations filters the full trigger and type join-row arrays once per entry (O(entries × joinRows)); syncAchievements() runs it synchronously on every entry save/edit before the 200 ms back-navigation timer is scheduled, so the Save delay grows quadratically with diary size. Group join rows into Map<entry_id, …> once, as sevenDayTrend.ts already does.

**Evidence:** queries.ts:304-311: `entries.map(entry => ({ ..., tinnitus_types: entryTypes.filter(et => et.entry_id === entry.id)..., triggers: entryTriggers.filter(et => et.entry_id === entry.id)... }))`. Called from src/features/achievements/sync.ts:13 inside `syncAchievements()`, which app/entry/new.tsx:333 and app/entry/[id].tsx:279 call right after saving, ahead of `router.back()`. By contrast sevenDayTrend.ts:41-53 already groups join rows into Maps once.

**What goes wrong:** A diary with 2000 entries and ~3 triggers + 3 types each: ~24 million comparisons on the JS thread on every Save tap, so the 200 ms 'Saved' delay before navigating back visibly stretches on mid-range Android phones and grows quadratically with the diary.

**Suggested fix:** Group `getAllEntryTriggers()`/`getAllEntryTinnitusTypes()` into `Map<entry_id, ...>` once and look up per entry (same approach as `processEntries`).

### A152. [LOW · performance] Every save re-evaluates achievements over the whole diary with an O(entries × join rows) scan on the JS thread
**Where:** `app/db/queries.ts:306`  ·  **Verifiers upholding:** 3/3

**What:** getAllEntriesWithRelations() (app/db/queries.ts:300-312) filters the full entry_triggers and entry_tinnitus_types arrays once per entry (O(entries × join rows)); syncAchievements() calls it synchronously in both save handlers (app/entry/new.tsx:333, app/entry/[id].tsx:279) before setSaved(true), and evaluateAchievements also refits the trigger model each time, so save latency grows with diary size.

**Evidence:** app/entry/new.tsx:333 and app/entry/[id].tsx:279 call `syncAchievements()` synchronously inside handleSave; src/features/achievements/sync.ts:12-13 calls `getAllEntriesWithRelations()`; app/db/queries.ts:299-312 does `entries.map(entry => entryTypes.filter(et => et.entry_id === entry.id) ... entryTriggers.filter(...))`, i.e. a full scan of both join arrays per entry.

**What goes wrong:** A long-term user with 1,500 entries and ~4,000 join rows: each Save performs ~12 million comparisons synchronously (plus the SQL) between the tap and the green 'Entry saved' feedback, producing a perceptible stall that grows with diary size.

**Suggested fix:** Group join rows into a Map keyed by entry_id once (as processEntries in sevenDayTrend.ts already does), and/or run syncAchievements after navigation (e.g. in an InteractionManager/setTimeout callback) rather than on the tap's critical path.

### A153. [LOW · performance] Per-save achievement sync and per-row date formatting scale badly with diary size
**Where:** `app/db/queries.ts:306`  ·  **Verifiers upholding:** 3/3

**What:** getAllEntriesWithRelations (queries.ts:306-311) filters the full join-row arrays once per entry (O(entries x joinRows)) and is run on every entry save/edit via syncAchievements (sync.ts:13, new.tsx:334, [id].tsx:279), which also refits the trigger model over the whole diary (evaluate.ts:126); Home's formatEntryDate (index.tsx:52-54) constructs an Intl.DateTimeFormat per recent-entry row on every focus although formatEntryTime/formatDateKey cache theirs.

**Evidence:** entry/new.tsx:334 and entry/[id].tsx:279 `syncAchievements();` -> sync.ts:13 `getAllEntriesWithRelations()` -> queries.ts:304-311 `entries.map(entry => ({ tinnitus_types: entryTypes.filter(et => et.entry_id === entry.id) ..., triggers: entryTriggers.filter(...) }))`; evaluate.ts:126 `fitTriggerModel(...)` on the whole diary. (tabs)/index.tsx:52-55 `new Intl.DateTimeFormat(undefined, {...timeZone: entry.timezone}).format(...)` inside formatEntryDate, called per row at :267; datetime.ts:40-43 documents the 20x cost and caches elsewhere.

**What goes wrong:** At 2,000 entries with ~5,000 join rows the nested filter does ~10M comparisons on the JS thread on every Save tap, adding a noticeable pause before the 200 ms 'Saved' transition; Home re-creates 20 formatters on every focus.

**Suggested fix:** Build the relation maps once (Map<entry_id, string[]>) in getAllEntriesWithRelations, memoise the formatter in formatEntryDate per timezone, and consider evaluating only metric achievements incrementally.

### A154. [LOW · performance] All 28 locale JSON files are eagerly bundled into the JS bundle
**Where:** `app/i18n/index.ts:40`  ·  **Verifiers upholding:** 2/3

**What:** All 28 locale JSON files (~758 KB) are statically imported (lines 3-30) and eagerly registered in i18next `resources` (lines 40-69), so every translation ships in every bundle; acceptable trade-off for synchronous offline language switching, worth revisiting only if bundle size becomes a concern.

**Evidence:** app/i18n/index.ts:3-30 static `import xx from './locales/xx.json'` for all 28 files; :40-69 `resources: { en: {...}, ..., lt: {...} }`. `wc -c app/i18n/locales/*.json` = 758,573 bytes total (en 34,647).

**What goes wrong:** Each release carries all translations in the Hermes bytecode regardless of the selected language; a user only ever reads one (plus the en fallback).

**Suggested fix:** Low priority; if bundle size becomes a concern, keep `en` bundled, set `partialBundledLanguages: true`, and `addResourceBundle` the selected locale from a `require` map inside `changeLanguage`.

### A155. [LOW · performance] Three 1 MB onboarding PNGs account for ~3 MB of the app for illustrations shown once
**Where:** `app/onboarding/index.tsx:22`  ·  **Verifiers upholding:** 3/3

**What:** Three ~1 MB 1254x1254 opaque-RGB onboarding PNGs (~3 MB, the largest tracked files in the repo) are bundled unconditionally via require() and rendered at ~40% of screen height with resizeMode="contain" — oversized for the display size and uncompressed; re-exporting at ~800 px as WebP/optimized PNG would cut install and OTA size several-fold.

**Evidence:** assets/onboarding/slide1.png 1254x1254 1078 KB, slide2.png 1004 KB, slide3.png 939 KB (git-tracked; the next largest tracked file is package-lock.json); assets/icon.png is 24 KB at 1024x1024. Used at app/onboarding/index.tsx:22-24 via require() and rendered with `<Image ... resizeMode="contain" />` at `width: '100%', height: '100%'` (lines 30, 169-171).

**What goes wrong:** Every install and every OTA update ships ~3 MB for three screens the user sees once; on the clone side the repo carries 3 MB of binaries that change wholesale on each redesign.

**Suggested fix:** Re-export as optimized PNG (pngquant) or WebP (expo-image/Image support it) at ~800px; expect ~5–10x smaller files.

### A156. [LOW · security] SYSTEM_ALERT_WINDOW and legacy external-storage permissions ship because app.json never blocks Expo's optional defaults
**Where:** `app.json:18`  ·  **Verifiers upholding:** 3/3

**What:** app.json's `android` block (lines 18-28) sets no `blockedPermissions`, so prebuild ships Expo's optional template defaults — SYSTEM_ALERT_WINDOW plus READ/WRITE_EXTERNAL_STORAGE (the latter maxSdkVersion=32, inert on Android 13+) — even though the app only uses SAF, DocumentPicker-to-cache and cache files, which need none of them.

**Evidence:** android/app/src/main/AndroidManifest.xml:3-6 declares `READ_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`, `VIBRATE`, `WRITE_EXTERNAL_STORAGE`. Source: node_modules/@expo/config-plugins/build/plugins/withAndroidBaseMods.js:61-67 (template comment: "OPTIONAL PERMISSIONS, REMOVE WHATEVER YOU DO NOT NEED") and node_modules/expo-file-system/plugin/build/withFileSystem.js:8-9 adding the storage pair. app.json:18-28 `android` block has no `blockedPermissions` (supported at node_modules/@expo/config-plugins/build/android/Permissions.js:64-65). File I/O in the app is SAF (my-data.tsx:55-64), DocumentPicker with copyToCacheDirectory (:192) and cache files (:163, reportExport.ts:6-7).

**What goes wrong:** Play Console lists 'Display over other apps' and storage permissions for a health diary that never requests them; SYSTEM_ALERT_WINDOW in particular is a flagged permission in Play policy reviews and in third-party security scanners, and it is only meaningful for the RN dev error overlay. Note the local manifest is a stale Aug-11 prebuild (it predates expo-notifications/local-authentication/Firebase and lacks POST_NOTIFICATIONS, USE_BIOMETRIC, RECEIVE_BOOT_COMPLETED), so it cannot be used as the release reference; the fix belongs in app.json.

**Suggested fix:** Add `"android": { "blockedPermissions": ["android.permission.SYSTEM_ALERT_WINDOW", "android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"] }` to app.json and re-run prebuild; then review the regenerated manifest (not the stale one) before the next release.

### A157. [LOW · security] Android auto-backup is left on (Expo default), so the SQLite health diary is uploaded to Google Drive outside the App Lock
**Where:** `app.json:18`  ·  **Verifiers upholding:** 3/3

**What:** `expo.android` in app.json sets no `allowBackup`, so the Expo config plugin defaults the generated (gitignored) AndroidManifest to `android:allowBackup="true"` with no `fullBackupContent`/`dataExtractionRules`; the whole private data dir, including the SQLite health diary `tinnitus.db` and the `settings` table, is included in Google auto-backup regardless of App Lock, which only gates the UI.

**Evidence:** AndroidManifest.xml:14 `android:allowBackup="true"`; node_modules/@expo/config-plugins/build/android/AllowBackup.js:26 `return config.android?.allowBackup ?? true;`; app.json:18-28 has no `allowBackup` key. The DB is a plain file opened at database.ts:4 `SQLite.openDatabaseSync('tinnitus.db')`; App Lock only gates the UI (app/_layout.tsx:61) and the app describes itself as local-first with an explicit, user-driven export (my-data.tsx).

**What goes wrong:** A user who enables App Lock and never exports still has their entries, notes and `settings` (name, app_lock_enabled, export_dir_uri) copied to their Google account's device backup and restored onto any device signed into that account, which is a different data flow than the one the My Data screen presents.

**Suggested fix:** Decide explicitly: either set `"android": { "allowBackup": false }` in app.json (matching the local-first/App Lock story and the manual export path), or keep it on and add a `fullBackupContent`/`dataExtractionRules` XML that excludes `databases/` and `files/SQLite` while allowing preferences. Either way it should be a recorded decision rather than the template default.

### A158. [LOW · security] iOS export and import leave health-data copies in the cache directory, and iOS export is recorded as completed even if the share sheet is cancelled
**Where:** `app/my-data.tsx:163`  ·  **Verifiers upholding:** 3/3

**What:** iOS export writes the full backup JSON to Paths.cache and never deletes it (contrast reportExport.ts finally-delete); import's copyToCacheDirectory copy is never deleted; and last_exported_at plus the export_completed event are recorded on iOS even when the share sheet is dismissed. Note: expo-sharing's iOS shareAsync resolves identically for shared vs dismissed, so the fix is to clean up in finally and avoid claiming "exported" on iOS, not to gate on a completion signal.

**Evidence:** my-data.tsx:163-169 `const file = new File(Paths.cache, 'tinnitus-tracker-backup-...json'); ... file.write(json); ... await Sharing.shareAsync(file.uri, ...)` with no delete afterwards; :172-175 `setSetting('last_exported_at', now); ... logEvent('export_completed', ...)` run unconditionally; :192 `getDocumentAsync({ ..., copyToCacheDirectory: true })` with no cleanup. Contrast reportExport.ts:17-19, which deletes the shared PDF precisely because "Keeping reports in cache would leave sensitive health summaries behind with no user-visible way to remove them".

**What goes wrong:** iOS user opens Export, then dismisses the share sheet: the summary card now says 'Last exported: today' and `export_completed` is logged, while no backup was saved; a full plaintext copy of every entry and note sits in the app's cache until the OS evicts it. Every import leaves another copy. Delete All Data does not touch these files.

**Suggested fix:** Delete the cache file after `shareAsync` resolves on iOS (the completion handler fires after the activity finishes) and delete the DocumentPicker copy after parsing (in `finally`). Only set `last_exported_at`/log the event when the share actually completed (iOS reports completion; on Android the SAF write is the completion signal, which is already the case).

### A159. [LOW · security] Import reads and parses the whole picked file synchronously with no size cap
**Where:** `app/my-data.tsx:196`  ·  **Verifiers upholding:** 2/3

**What:** Import reads the picked file fully into memory and JSON.parses it with no size cap (asset.size unused), then runs an unbounded synchronous insert loop (queries.ts:338) with no transaction; a large or mis-picked .json freezes the UI before any error is shown.

**Evidence:** my-data.tsx:196-197 `const text = await new File(asset.uri).text(); const parsed = JSON.parse(text);` then :200 synchronous `importEntries`. `asset.size` is never consulted (grep for `.size` in my-data.tsx is empty). DocumentPicker's `type: 'application/json'` (:192) is only a filter hint on Android file managers.

**What goes wrong:** User picks a large non-backup .json (or a mislabelled file) by mistake: the app freezes while reading/parsing, and on low-memory devices the string allocation can OOM-kill the process with no error dialog. A huge valid backup blocks the UI for the entire insert loop.

**Suggested fix:** Reject files above a sane cap (e.g. a few MB, using `asset.size` before reading) with the existing importFailed dialog, and validate `parsed.entries.length` against a maximum before inserting. Keep the transaction from the earlier finding so a late abort costs nothing.

### A160. [LOW · testing] Calibration study reports FAIL but always exits 0
**Where:** `tests/stats/calibration.test.ts:204`  ·  **Verifiers upholding:** 3/3

**What:** The calibration study prints PASS/FAIL from `allOk` but never exits non-zero or throws (unlike the .validation.ts scripts' throwing `assert`), so if it is ever wired into a script or CI step a MISCALIBRATED result would be treated as a pass; today nothing consumes its exit code (no test script in package.json, no CI workflow).

**Evidence:** tests/stats/calibration.test.ts:189-203 compute `allOk` and print `${allOk ? 'PASS' : 'FAIL'} — displayed probabilities ${allOk ? 'did not overclaim' : 'overclaimed'}`; there is no `process.exit(1)` or thrown error anywhere in the file (unlike the two .validation.ts files, whose `assert` throws). Line 209 says 'Re-run this study after any model or display-threshold change', i.e. it is meant as a gate.

**What goes wrong:** A change to PRIOR_SD or DELTA in app/stats/triggerModel.ts makes stated 90% claims true only 60% of the time; the study prints MISCALIBRATED/FAIL, the process exits 0, and any script or CI step treats it as a pass — users get overconfident trigger claims in a health app.

**Suggested fix:** End with `if (!allOk) process.exit(1);` (or throw), and keep it in a separate `test:calibration` script because of its runtime.

### A161. [LOW · ux] Hard-coded light-mode colours leak into dark mode on the Calendar count badge and Learn list
**Where:** `app/(tabs)/calendar.tsx:578`  ·  **Verifiers upholding:** 3/3

**What:** Calendar multi-entry count badge (#334155) and Learn's cream guide-icon chips/amber category labels (#FEF3C7/#D97706 in app/learn/index.tsx:96,99 and app/learn/[slug].tsx:72) are hard-coded light-mode colours with no dark-theme branch; in dark mode the badge circle has ~1.7:1 contrast against the card (digit remains legible as white-on-slate) and Learn shows bright cream squares, diverging from the isDark-aware goldBg pattern in app/achievements.tsx:120.

**Evidence:** calendar.tsx:571-588 `countBadge: { ... backgroundColor: '#334155' ... }`, `countBadgeText: { ... color: '#fff' }` (contrast on dark surface #151C2E = 1.64:1). learn/index.tsx:96 `rowIcon: { ... backgroundColor: '#FEF3C7' ... }`, :99 `category: { color: '#D97706' ... }`; learn/[slug].tsx:72 same. Compare achievements.tsx:118-121 `const goldBg = isDark ? hexToRgba(GOLD, 0.18) : '#FEF3C7';` with the comment "Amber chips on a dark surface need a translucent tint ... which glares".

**What goes wrong:** Dark theme: a day with two entries shows a near-invisible dark-grey "2" badge on the dark calendar card; the Learn index shows bright cream squares on a dark list.

**Suggested fix:** Use `isDark ? hexToRgba(colors.textPrimary, 0.25) : '#334155'` for the badge and the achievements goldBg pattern for Learn.

### A162. [LOW · ux] Home greeting is computed once per language and never refreshed, so it goes stale while the app stays open
**Where:** `app/(tabs)/index.tsx:96`  ·  **Verifiers upholding:** 3/3

**What:** Home greeting is memoised on [t] only and the always-mounted tab never recomputes it on focus/resume, so the time-of-day greeting goes stale while the app stays open.

**Evidence:** index.tsx:96 `const greet = useMemo(() => greeting(t), [t]);`; :89-94 useFocusEffect only calls `setUserName` and `setEntries`; :35-40 greeting reads `new Date().getHours()` at call time.

**What goes wrong:** App opened at 11:50, left in the background, reopened at 19:00 (App Lock re-lock does not remount Home): the header still says "Good morning, Alex".

**Suggested fix:** Compute the greeting inside the focus effect (store an hour bucket in state) or derive it in render from a `now` state refreshed on focus.

### A163. [LOW · ux] 'Not enough data for this period yet' is shown for two cases where it is false: the 7D range (model can never run) and a trigger present on every logged day
**Where:** `app/(tabs)/trends.tsx:743`  ·  **Verifiers upholding:** 3/3

**What:** The trigger panel collapses three distinct "no estimate" causes into one generic message: the 7D range can never reach MIN_OBSERVATIONS=8 days (triggerModel.ts l.91/l.158, filterItems l.60-66), and a trigger logged on every day in the period is dropped as collinear (triggerModel.ts l.153-156); `model.result.insufficient` is never read in trends.tsx, so both the list (l.741-743) and chips (l.654-656) views show 'Not enough data for this period yet' even directly under 'N of N days'.

**Evidence:** triggerModel.ts l.91 `MIN_OBSERVATIONS = 8`, l.158 returns insufficient when `n < 8`; trends.tsx l.1524 fits on `filterItems(processed, range)` which for '7D' has <= 7 distinct days (sevenDayTrend.ts l.60-64). triggerModel.ts l.153-156 drops any trigger with `k === n`; trends.tsx l.1541-1545 maps those to null and l.743 renders `t('stats.trigger.notEnoughYet')`.

**What goes wrong:** A user who logs every day with 'Stress' ticked for 30 days opens the trigger's panel in 30D and reads 'Not enough data for this period yet' under '30 of 30 days'; on 7D every trigger shows that message forever, with no hint that the model needs 8 days.

**Suggested fix:** Add distinct copy: for 7D, 'Trigger estimates need at least 8 logged days — switch to 30D'; for an always-present trigger, 'Logged on every day in this period, so there are no trigger-free days to compare against'.

### A164. [LOW · ux] Day-of-week card and 90D weekly buckets hard-code Monday-first, ignoring the First Day of Week setting the Calendar honours
**Where:** `app/(tabs)/trends.tsx:785`  ·  **Verifiers upholding:** 3/3

**What:** Stats day-of-week buckets (trends.tsx l.785) and 90D weekly buckets (sevenDayTrend.ts l.139-141, duplicated at l.385-387) are hard-coded Monday-first and never read useFirstDayOfWeek().resolvedFirstDay, so they disagree with the Calendar tab when the user picks Sunday or Saturday.

**Evidence:** trends.tsx l.784-785 `buckets[dow === 0 ? 6 : dow - 1]` with dowLabels fixed Mon..Sun (en.json stats.dowLabels); app/stats/sevenDayTrend.ts l.139-141 `thisMonday` is always Monday; computeLeadingValue l.385-387 repeats it. app/contexts/FirstDayOfWeekContext.tsx l.5 offers 'sunday' | 'monday' | 'saturday' and app/(tabs)/calendar.tsx l.70 uses `useFirstDayOfWeek()` to rotate its grid.

**What goes wrong:** A US user sets Sunday as first day: the Calendar tab starts weeks on Sunday, but the Stats day-of-week chart starts on Monday and each 90D bar is a Mon–Sun week, so 'this week' on the chart does not match 'this week' on the calendar.

**Suggested fix:** Read `resolvedFirstDay` from useFirstDayOfWeek in StatsScreen, rotate dowLabels and the bucket index accordingly, and pass the first day into weeklyItemBuckets/computeLeadingValue so 90D weeks align with the calendar.

### A165. [LOW · ux] Range change closes list panels but not the chip-view panel, and the day-before/day-after tiles show point estimates with no uncertainty
**Where:** `app/(tabs)/trends.tsx:1472`  ·  **Verifiers upholding:** 3/3

**What:** pickRange (l.1472) clears only list-view `openTriggers`; chip-view `chipSelected` (l.441, TriggersCard-local, no range key/prop) stays open across a range switch and its panel silently re-renders with new-range figures, contradicting the comment at l.1467-1471. Separately, fitTemporalProfile (triggerModel.ts:363-366) returns only `.effect` for the lag/lead terms, so the Day-after/Day-before tiles (trends.tsx:362-375) show a coloured point estimate with no 95% interval, unlike the same-day effect above them (l.295-296).

**Evidence:** pickRange l.1472 resets only `openTriggers`; `chipSelected` state lives inside TriggersCard (l.441) and survives, so the comment at l.1467-1471 ('panels opened against the old range are closed') is only true for list view. fitTemporalProfile l.362-365 picks `.effect` only, discarding ciLow/ciHigh, and the tiles at l.362-375 print `signedLevels(temporal.dayAfter)` with a colour but no interval, while the same-day effect directly above carries a 95% range (l.295-304).

**What goes wrong:** In chip view, switch 30D to 90D: the open chip panel stays open and its figures silently change underneath the user. In the surrounding-days block, a 'Day after +0.4' resting on two adjacent day pairs reads with the same authority as a same-day effect backed by 60 days.

**Suggested fix:** Lift chipSelected to StatsScreen (or reset it via a `range` prop/key) so both views behave as the comment claims; return ciLow/ciHigh for the lag/lead terms and show them as a muted range under each tile, or hide tiles whose interval spans more than BAR_DOMAIN.

### A166. [LOW · ux] Saved language is applied in a passive effect after the first commit, so the first painted frame is English
**Where:** `app/contexts/LanguageContext.tsx:86`  ·  **Verifiers upholding:** 3/3

**What:** i18n boots with lng 'en' and LanguageProvider only calls i18n.changeLanguage in a passive useEffect (:86-91) despite resolving the saved language synchronously (:76-84); the first commit of the whole tree therefore renders in English and every useTranslation consumer re-renders once the effect runs. The visible flash is unverified (splash hide is async), but the redundant startup re-render is certain; the same ordering also lets _layout.tsx:101 schedule reminder notification text via i18n.t before the language is applied.

**Evidence:** app/i18n/index.ts:70 `lng: 'en'`; app/contexts/LanguageContext.tsx:76-84 compute `setting`/`resolvedLanguage` synchronously, :86-91 `useEffect(() => { i18n.changeLanguage(resolvedLanguage); ... }, [resolvedLanguage])`; app/_layout.tsx:114 `<SafeAreaProvider ... onLayout={() => SplashScreen.hideAsync()}>` hides the splash on the first layout, i.e. before passive effects of that commit necessarily run.

**What goes wrong:** Non-English user cold-starts: the first committed frame renders every `t()` in English, then the effect switches language and the tree re-renders — a one-frame flash plus a full extra render of the app.

**Suggested fix:** Call `i18n.changeLanguage(resolved)` inside the `useState` initializer (synchronous with bundled resources) or resolve the saved setting in `app/i18n/index.ts` and pass it as `lng`.

### A167. [LOW · ux] Intensity scale buttons expose no accessibility role, label or selected state
**Where:** `app/entry/new.tsx:65`  ·  **Verifiers upholding:** 3/3

**What:** Intensity scale Pressables (new.tsx:65, [id].tsx:59) expose no accessibilityRole or accessibilityState; screen readers hear the level label but not that it is a selectable control or which level is currently selected.

**Evidence:** app/entry/new.tsx:65-93 and app/entry/[id].tsx:59-87: `<Pressable key={i} onPress=... style=...>` wraps an SVG IntensityIcon and a 9 pt uppercase label with `adjustsFontSizeToFit`; no accessibility props. Compare CustomizeLink.tsx:25-26, which does set role and label.

**What goes wrong:** TalkBack/VoiceOver user cannot tell which of the six buttons is selected or what level each represents; since intensity is mandatory (handleSave blocks without it, line 308), they cannot reliably complete a check-in.

**Suggested fix:** Add `accessibilityRole="radio"`, `accessibilityLabel={label}` and `accessibilityState={{ selected }}` to each scale button, and group them with `accessibilityRole="radiogroup"`.

### A168. [LOW · ux] Back navigation discards a partially filled form with no confirmation
**Where:** `app/entry/new.tsx:344`  ·  **Verifiers upholding:** 3/3

**What:** Add and edit entry screens (app/entry/new.tsx:344, app/entry/[id].tsx:306) pop on back with no unsaved-changes prompt; no beforeRemove/usePreventRemove/BackHandler anywhere in the app and gestures stay enabled for these routes (app/_layout.tsx:73-74), so hardware back or swipe-back silently discards a partially filled form or unsaved edits.

**Evidence:** app/entry/new.tsx:344 `<PressableScale onPress={() => router.back()} ...>` and app/entry/[id].tsx:306 do the same; neither screen registers a `beforeRemove` listener and app/_layout.tsx:73-74 configures the entry screens without `gestureEnabled: false`.

**What goes wrong:** User selects intensity, four triggers and types a long note, then accidentally swipes back / presses Android back. Everything is lost silently; on Edit, modifications are dropped without warning.

**Suggested fix:** Track a dirty flag (or compare against initial values) and show the existing ConfirmDialog on back when dirty, via navigation's `beforeRemove`.

### A169. [LOW · ux] Notes field has no length limit, unlike every other text input in the app
**Where:** `app/entry/new.tsx:488`  ·  **Verifiers upholding:** 3/3

**What:** Notes TextInput in both the add (app/entry/new.tsx:488) and edit (app/entry/[id].tsx:469) forms has no maxLength, and neither the DB column nor the queries bound it, unlike every other text input in the app (all capped at 25-40 chars); the expanded entry row (ExpandableEntryRow.tsx:212) then renders the full note unclamped.

**Evidence:** app/entry/new.tsx:488-498 and app/entry/[id].tsx:469-479 render `<TextInput multiline ... value={notes} onChangeText={setNotes}>` with no `maxLength`; grep shows maxLength only in AddItemModal.tsx:81 (40), EditNameModal.tsx:72 (25), AddReminderModal.tsx:83, onboarding/name.tsx:56.

**What goes wrong:** A pasted multi-thousand-character note is stored verbatim, rendered in full in the expanded ExpandableEntryRow (line 212, no numberOfLines) and in exports/PDF, making the row and report layouts unwieldy.

**Suggested fix:** Add a sensible `maxLength` (e.g. 500–1000) with a small counter, consistent with the other inputs.

### A170. [LOW · ux] Layouts use physical left/right properties and unmirrored chevrons (RTL not ready for the planned Arabic)
**Where:** `app/language.tsx:156`  ·  **Verifiers upholding:** 2/3

**What:** Layouts rely on physical left/right style properties and unmirrored ChevronLeft/ChevronRight icons with no I18nManager handling; not a bug today (no RTL locale shipped), but will misplace accents and back arrows when the backlogged Arabic locale is added since android:supportsRtl="true" mirrors flex rows automatically.

**Evidence:** app/language.tsx:156 `borderLeftWidth: 4` (selected-row accent); app/components/ExpandableEntryRow.tsx:278 `borderLeftWidth: 4`, :293/:340 `paddingLeft: 12`; repo-wide counts in app/ and src/: 21 `marginLeft`, 9 `borderLeftWidth`, 56 `ChevronLeft`, 21 `ChevronRight`, 0 `I18nManager`/`marginStart`/`borderStart`. android/app/src/main/AndroidManifest.xml:14 `android:supportsRtl="true"`.

**What goes wrong:** Not a current bug (no RTL language shipped). When Arabic is added, the selected-language accent stays on the physical left of a right-aligned row and back chevrons point away from the back direction.

**Suggested fix:** While touching these files, switch to `borderStartWidth`/`marginStart`/`paddingStart` and a small direction-aware chevron wrapper; keep it in the Arabic backlog item.

### A171. [LOW · ux] Unknown-slug fallback renders a bare text with no header or back button
**Where:** `app/learn/[slug].tsx:26`  ·  **Verifiers upholding:** 3/3

**What:** Not-found branch (lines 26-28) returns only the notFound text; the header/back control from lines 32-37 is absent and the root Stack hides native headers, so an unknown slug via the tinnitus-app:// scheme leaves no in-app way back.

**Evidence:** [slug].tsx:26-28 — `if (!article) { return <View style={ss.safe}><Text style={[ss.missing, …]}>{t('learn.notFound')}</Text></View>; }` — the `<View style={ss.header}>` with `PressableScale onPress={() => router.back()}` only exists in the found branch (lines 32-37). app.json:5 declares `"scheme": "tinnitus-app"`, so `tinnitus-app://learn/anything` reaches this route with an arbitrary slug.

**What goes wrong:** Open `tinnitus-app://learn/sleep-tips` (typo, stale link, or a slug renamed in a future release) on iOS: the user sees one centred sentence and no way to leave other than the edge-swipe gesture; on Android only the hardware back works.

**Suggested fix:** Render the same header/back row in the not-found branch (or hoist the header above the conditional), and optionally `router.replace('/learn')` when `article` is undefined.

### A172. [LOW · ux] "Skip" on the onboarding slides does the same thing as "Continue" on the last slide and does not skip the rest of onboarding
**Where:** `app/onboarding/index.tsx:24`  ·  **Verifiers upholding:** 3/3

**What:** All three onboarding slides set `showSkip: true` (lines 22-24), so the `skipSpacer` branch (line 130) is dead and on the last slide "Continue" (line 68) and "Skip" (line 73) both push `/onboarding/name`; "Skip" only skips the intro slides, not the required name entry or disclaimer.

**Evidence:** index.tsx:21-25 every SLIDES entry has `showSkip: true`; :62-70 goNext on the last slide → `router.push('/onboarding/name')`; :72-74 skip → `router.push('/onboarding/name')`; :125-131 the `skipSpacer` branch can never render.

**What goes wrong:** User on slide 3 sees "Continue" and "Skip" that lead to the identical screen; a user who taps Skip expecting to land in the app still has to type a name and accept the disclaimer.

**Suggested fix:** Hide Skip on the last slide (set showSkip false, which the code already supports) and make the label honest ("Skip intro").

### A173. [LOW · ux] Reminder is enabled and scheduled before the permission prompt; a denial leaves the switch on with nothing that can fire
**Where:** `app/reminders.tsx:58`  ·  **Verifiers upholding:** 2/3

**What:** toggleEnabled (and handleAddReminder, line 73-77) persist enabled=1 and schedule the notification before awaiting ensureNotificationPermission; on denial only a one-time StatusDialog is shown, the Switch stays on, and no later focus/launch path re-checks or surfaces the blocked state (app/_layout.tsx:100-101 silently skips sync).

**Evidence:** app/reminders.tsx:56-65 `updateReminder(reminder.id, { enabled: enabling }); refreshAndSync(getReminders()); ... if (enabling) { const granted = await ensureNotificationPermission(); if (!granted) setPermissionBlocked(true); }` — no revert of the toggle. app/_layout.tsx:100-101 then silently skips the sync on later launches when permission is absent.

**What goes wrong:** Android 13+: first-time enable → system dialog → 'Don't allow' → StatusDialog explains, but the Switch stays on and `enabled=1` persists; the Reminders screen keeps claiming a daily reminder is active while nothing is ever delivered, and the user has no in-screen indication on later visits.

**Suggested fix:** Request permission before writing/scheduling; on denial revert `enabled` (or keep it but render an inline 'Notifications blocked — open settings' state next to the switch and re-check permission on focus).

### A174. [LOW · ux] Delete icons are 24×24pt and several icon buttons are under the 44pt/48dp minimum tap target
**Where:** `app/reminders.tsx:139`  ·  **Verifiers upholding:** 3/3

**What:** Delete buttons on Reminders/Triggers/Sound Types are 24×24pt (16px icon + padding 4, style applied to PressableScale's inner view, no hitSlop) and sit 12pt from a Switch; info buttons (~39pt), chart view toggles (~38×30) and 38×38 back buttons are also under the 44pt/48dp minimum.

**Evidence:** reminders.tsx:320-322 `trashBtn: { padding: 4 }` used at :139-141 with `<Trash2 size={16} .../>` and no hitSlop; triggers.tsx:289-291 + :128-130 and sound-types.tsx:129 identical. new.tsx:568 `infoBtn: { padding: 2 }` + 15px icon + hitSlop 10 (:120,208). trends.tsx:1818 `viewOption: { paddingVertical: 4, paddingHorizontal: 8 }` + 14px icon, hitSlop 4 (:1687-1698). settings.tsx:200-212 `backBtn: { width: 38, height: 38 }` (same on every screen).

**What goes wrong:** User tries to delete a custom reminder; the 24pt trash sits 12pt from a 51pt Switch (rowActions gap 12), so a slightly-off tap toggles the reminder instead of deleting it.

**Suggested fix:** Give trash/info/toggle Pressables a 44pt box or `hitSlop={12}`; bump back buttons to 44.

### A175. [LOW · ux] Developer-only 'Reset onboarding' section and three 'Coming soon' menu rows ship in the production UI
**Where:** `app/settings.tsx:171`  ·  **Verifiers upholding:** 3/3

**What:** Settings renders a Developer section with a 'Reset onboarding' action (marked TODO-remove, no __DEV__ gate, no confirmation) in all builds; More tab's Pitch Test, Rate App and Widgets rows (more.tsx:185/254/274) route to the /coming-soon placeholder.

**Evidence:** settings.tsx:170-180 `{/* TODO: remove before release */} <Text ...>{t('settings.developerSection')}</Text> ... <PressableScale onPress={handleResetOnboarding}` (no __DEV__ check; grep shows __DEV__ only in app/utils). more.tsx:111 `const cs = (titleKey) => () => router.push({ pathname: '/coming-soon', ... })` used at :185 (pitchTest), :254 (rateApp), :274 (widgets).

**What goes wrong:** A user taps 'Reset onboarding' in Settings and is thrown back into the first-run flow; three visible menu items dead-end on 'Coming soon', which also tends to fail store review for placeholder content.

**Suggested fix:** Wrap the Developer section in `__DEV__ &&`; hide the three rows behind a remote-config flag (the infrastructure already exists in app/utils/remoteConfig.ts) until the features exist.

### A176. [LOW · ux] 'Curious mind' milestone says 'Read one of the guides in Learn' but opening the statistics guide listed on the Learn screen never unlocks it
**Where:** `app/statistics-methodology.tsx:20`  ·  **Verifiers upholding:** 2/3

**What:** 'Curious mind' (first_guide) is only unlocked by app/learn/[slug].tsx:23; StatisticsMethodologyScreen, reachable as the first row of the Learn screen (app/learn/index.tsx:42) and self-described as "a plain-language guide", never calls unlockEvent('first_guide'), so reading it leaves the milestone locked despite the copy "Read one of the guides in Learn."

**Evidence:** app/learn/[slug].tsx:22-24 — `useEffect(() => { if (article) unlockEvent('first_guide'); }, [article?.slug]);` is the only call site (grep for unlockEvent finds [slug].tsx and reports). app/statistics-methodology.tsx has no import of unlockEvent. app/learn/index.tsx:40-50 lists the guide on the Learn screen; en.json achievements.items.first_guide.body = 'Read one of the guides in Learn'; guide.ts:25 summary begins 'A plain-language guide…'.

**What goes wrong:** A user opens Learn, taps 'How your statistics work' (the first row), reads it fully, returns to Milestones and 'Curious mind' is still locked despite having read a guide from Learn.

**Suggested fix:** Call `unlockEvent('first_guide')` in StatisticsMethodologyScreen on mount as well, or change the milestone copy to 'Read one of the articles in Learn'.

### A177. [LOW · ux] Linking.openURL rejections are unhandled on five screens, so buttons silently do nothing without a mail/browser app
**Where:** `app/support.tsx:54`  ·  **Verifiers upholding:** 3/3

**What:** Linking.openURL is fire-and-forget on six call sites (support.tsx:54, support-directory.tsx:139, connect.tsx:43, about.tsx:14, learn/[slug].tsx:55, (tabs)/more.tsx:133), so when no handler app exists (most plausibly no mail client for the mailto: links) the promise rejects silently and the button does nothing, contradicting the "It'll open your mail app" copy; support-directory.tsx:73-79 already has the try/catch + StatusDialog pattern to reuse.

**Evidence:** support.tsx:54 `Linking.openURL(url);` (mailto). Also connect.tsx:43 `onPress={() => Linking.openURL(link.url)}`, about.tsx:14 `const openUrl = (url) => () => Linking.openURL(url);`, learn/[slug].tsx:55, (tabs)/more.tsx:133 `Linking.openURL(managementUrl ?? PLAY_SUBSCRIPTIONS_URL);`, and support-directory.tsx:139 for its own mailto. Contrast support-directory.tsx:73-79 `try { await Linking.openURL(item.url); } catch { setLinkError(true); }`. All targets are hard-coded https:/mailto: constants, so this is not a scheme-injection issue.

**What goes wrong:** On an Android device with no email client (work profile, de-Googled phone, emulator) the user taps 'Contact support'; the promise rejects, nothing visible happens, and the support copy ('It'll open your mail app...') is contradicted. In dev this shows as an unhandled-promise warning; in production it is just a dead button.

**Suggested fix:** Create one `openExternal(url)` helper that awaits openURL, catches, and surfaces the existing `localSupport.openErrorTitle/Body` style dialog (or a toast); use it on all six call sites. For mailto, consider showing the address so it can be copied when no client exists.

### A178. [LOW · ux] Note line breaks are collapsed in the PDF report
**Where:** `src/features/reports/reportHtml.ts:106`  ·  **Verifiers upholding:** 3/3

**What:** Notes with line breaks render as a single run-on line in the PDF report: `.note` (line 75) has no `white-space: pre-wrap`, and `escapeHtml` (lines 4-8) leaves '\n' untouched, so default whitespace collapsing applies.

**Evidence:** reportHtml.ts:106 `<div class="note"><b>${escapeHtml(date(note.date, locale))}</b><br/>${escapeHtml(note.note)}</div>`; `.note` CSS at :75 sets padding/border only, no `white-space: pre-wrap`; escapeHtml (:4-8) does not convert \n. Notes come from a multiline TextInput (app/entry/new.tsx:488-490).

**What goes wrong:** A note written as three lines ('Slept badly\nCoffee x3\nLoud concert') appears in the shared doctor report as 'Slept badly Coffee x3 Loud concert'.

**Suggested fix:** Add `white-space: pre-wrap;` to `.note` (and keep escapeHtml as is).
