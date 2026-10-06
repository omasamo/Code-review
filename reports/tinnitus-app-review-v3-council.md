# Tinnitus Tracker review v3: council verdict

## 1. Verdict

The app is not ready for public release at commit 5513c30, but it is close. The council (A release, B engineer, C privacy, D user) agrees that the core diary, stats and PDF work is solid and that analytics never carry symptom values. The blockers are mostly about configuration and launch scope, not engineering. All four seats put the same item first: fake "Alex" data is seeded on every install, and that seeding also skips the medical disclaimer (app/db/database.ts:104, :290-292). The council also agrees on four more points:
- Ship v1 free.
- Hide content that has not been reviewed.
- Make telemetry opt-in.
- Fix backup import and App Lock before launch.

The first launch is Android-only (eas.json:24-29 submits to the "internal" track). So Google Play policy and EU law matter more for v1 than Apple's rules.

## 2. Final top 10

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

## 3. What changed from v2

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

## 4. Where the council disagreed, and the chair's call

- **Seed data or consent first?** C put consent first. Decision: seed data first. It is a one-line fix that also hides the disclaimer from every user. Consent is #3.
- **Remote Config flip (D) vs code change (A, C).** Code change. I confirmed more.tsx:262 opens the paywall without a flag check and that remoteConfig.ts:6-9 defaults both flags to true.
- **Opt-out (D) vs opt-in (A, B, C).** Opt-in. Whether these events count as health data (C's Art. 9 argument) is debatable. But opt-in costs little and is the only safe reading. C named the Perf key wrong: the correct key is `perf_auto_collection_enabled`, which I checked against node_modules/@react-native-firebase.
- **Android backup.** It is not a launch blocker. Decide on backup after the import fix (#6) lands, and disclose it in the privacy policy.
- **Learn line number.** The Learn footer is at en.json:299, not :260 as C cited.
- **Finish reviews or cut scope?** Cut (A). The repo's own gate requires clinical review "before publishing Learn", not before publishing the app (docs/release-checklists/health-content-and-privacy.md:3-4).
- **Medical-device question (C).** Write a short memo and tighten the claims before launch. This is not a launch blocker, because the app frames results as associations, not diagnoses (content.ts:73).
- **Lock screen as an overlay or a Modal?** A Modal with back-button handling (B). A plain overlay still lets the hardware back button and TalkBack, the Android screen reader, reach the screen underneath (LockScreen.tsx has no BackHandler).

## 5. Plan

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