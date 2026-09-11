# Verification — 12 September 2026

## Automated checks

- App TypeScript: passed.
- Domain and sync tests: 12 passed.
- API HTTP integration tests: 9 passed.
- Server TypeScript compilation: passed.
- Final combined Expo export: web, iOS and Android passed from the current source, including both original photographs.
- Initial-build bundles: web 2.80 MB; Android Hermes 5.61 MB; iOS Hermes 5.60 MB. Updated onboarding bundle results appear below.
- Expo dependency compatibility: up to date. npm dependency tree: no problems.
- Dependency audit: no high/critical findings; residual moderate findings are documented in dependency-audit.md.

Tests cover equipment/time/day plan constraints, unit conversion and previous completed sets, experience-specific set counts, week boundaries, malformed state rejection, guest/account ownership, recovery and reset merging, account-deletion cache ownership, authentication, private data isolation, payload bounds, conditional sync conflicts, restart persistence, CORS, expiry, rate limiting, RevenueCat webhook authentication/idempotency/order/environment handling, account export and password-confirmed deletion.

## Actual browser journey

Inspected the running app through the Codex in-app browser at 375 × 812 and 1440 × 1024, with an intermediate-width layout also viewed. Tested a local sample profile, not real user fitness history.

1. Completed onboarding with Build muscle, Some experience, Dumbbells, four selected days and 30-minute sessions.
2. Verified those preferences in the plan reveal and dashboard, and verified persistence after reload.
3. Started the adapted upper-body session, recorded 12.5 kg × 10 reps, and marked the set complete.
4. Reloaded and resumed. The completed set, inputs and remaining rest time survived.
5. Saved a partial session after explicit confirmation. The journal and statistics showed one session and 125 kg of recorded volume.
6. Registered a local test account. The app reported successful account sync and retained the workout.
7. Signed out into a separate empty guest profile; used the direct returning-member sign-in to restore the account and its training.
8. Saved three workouts. Attempting a fourth opened Plus without granting unpurchased access. The web paywall accurately indicated native billing availability, and returned to free training.
9. Confirmed saved-workout filtering and empty search handling.
10. Corrected browser photo sizing, raw empty text rendering and invalid SVG props encountered during review. No new browser error entries appeared during the final account/bookmark journey after these fixes.

The workout component was also exercised independently at mobile/desktop widths: blank and invalid drafts, bounds validation, previous weight conversion, rest extension/skip, session reload, safe equipment-compatible swaps, partial completion, and discard confirmation.

## Limits of this verification

Native JS/Hermes export is not APK/IPA compilation, simulator execution, device testing, store review or real purchase confirmation. The PostgreSQL adapter/schema are present but no live PostgreSQL service was provisioned or exercised. RevenueCat webhook behavior is tested with local events; provider accounts, store products, sandbox transactions and external webhook delivery remain unconfigured.

Email verification/recovery, email delivery, health-device synchronization, workout videos, nutrition, community messaging and AI coaching are outside the implemented release. The README and service-specific setup documents describe launch requirements without claiming those services are live.

The preview is local to this computer. No site was publicly published and no source reference app credentials were copied.

## BodBot reference onboarding update

Adapted the supplied video into a live plan preview, original animated FORMA emblem, directional question transitions, spring selection feedback, five-question progress, and a concrete first-week reveal. Source observations and adaptation are in onboarding-reference.md.

- TypeScript passed; all 12 domain/sync tests passed.
- Combined Expo web, iOS and Android exports passed. Updated bundles are approximately 2.82 MB web, 5.63 MB iOS Hermes and 5.64 MB Android Hermes.
- Inspected responsive UI at 375 × 812, 812 × 375 landscape, and 1440 × 1000 desktop.
- Completed a separate guest journey at 127.0.0.1, keeping the user's localhost storage separate. Chose Build muscle, Some experience, Dumbbells, Mon/Tue/Wed/Fri and 30 minutes with sample name Alex.
- Verified the real preview updates equipment and set counts; it shows shorter recovery sessions when applicable.
- Verified one selected day disables Continue; five selected days disable further additions.
- Verified rapid double taps cannot skip the plan reveal, and returning to Equipment preserves all earlier choices.
- Verified heading focus on question navigation, explicit selected-button ARIA state and progress values in the rendered browser DOM.
- Verified landscape name entry and in-scroll primary action, final completion into the dashboard, and persistence after reload.
- The isolated final browser journey produced no console errors.

Reduced-motion behavior and animation cleanup were reviewed in source. The browser tools do not expose a reduced-motion override, and native OS accessibility settings, Dynamic Type, haptics and hardware Back still need device verification. No physical-device frame-rate claim is made.
