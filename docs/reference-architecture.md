# Era and Edixa architecture audit

Read-only inspection on 2026-09-12. This describes the checked-out source, not a claim that deployed services have been tested. No `.env` values were read, and neither source project was changed. No `AGENTS.md` was found inside either repository.

## Stack actually present

| Concern | Edixa | Era |
|---|---|---|
| Client | Expo `~54.0.35`, React Native `0.81.5`, React `19.1.0`, TypeScript `~5.9.2` | Native SwiftUI, Swift 5 language setting, iOS 17 minimum |
| Navigation | Expo Router `~6.0.24` | SwiftUI root state and screen flows |
| Motion | Reanimated `~4.1.1`, Worklets `0.5.1`, gesture handler `~2.28.0`, Expo Haptics | SwiftUI animations with Reduce Motion environment handling in onboarding |
| Purchases | RevenueCat `react-native-purchases ^10.2.0` | RevenueCat + RevenueCatUI, iOS SDK resolved to `5.80.3` |
| Local persistence | AsyncStorage `2.2.0`, Expo File System, SecureStore | SwiftData models and local external-storage images |
| Server | Express `^4.21.2`, TypeScript `^5.7.2`, `tsx ^4.19.2` | No separate app API evident in inspected sources |
| Database | PostgreSQL through Prisma `^7.8.0`, `@prisma/adapter-pg ^7.8.0`, `pg ^8.21.0` | Local SwiftData model container |
| Identity | Client-generated/RevenueCat-aligned account ID plus device bindings | No app account system; RevenueCat maintains purchase identity |
| Hosting | Checked-in Fly.io Docker configuration | Native iOS distribution |

Edixa versions above are manifest constraints, not verified installed versions. Era's purchase version is from `Package.resolved`. Edixa's database hosting vendor cannot be established from the inspected configuration; the source establishes PostgreSQL, not Supabase, Firebase, or any particular database host.

## Source locations

- Edixa manifests: `C:/Users/vauld/Documents/GitHub/Edixa/client/package.json` and `server/package.json`.
- Edixa native purchase adapter: `client/src/purchases/revenuecat.ts`.
- Edixa database schema and adapter: `server/prisma/schema.prisma`, `server/src/lib/db.ts`, and `server/prisma.config.ts`.
- Edixa server entitlement resolver and webhook: `server/src/lib/entitlements.ts`, `server/src/routes/webhooks.ts`.
- Edixa identity model: `client/src/identity/deviceId.ts`, `client/src/api/client.ts`, `server/src/lib/identity.ts`.
- Edixa onboarding and motion primitives: `client/src/components/OnboardingScaffold.tsx`, `client/src/components/Entrance.tsx`, `client/src/components/Buttons.tsx`.
- Edixa deployment: `server/fly.toml`, `server/Dockerfile`.
- Era app and data: `C:/Users/vauld/Documents/GitHub/Era/Era/EraApp.swift`, `Models.swift`.
- Era purchases: `PurchaseManager.swift`, `SubscriptionPresentation.swift`, `AppConfiguration.swift`.
- Era onboarding: `OnboardingFlow.swift`, `OnboardingKit.swift`, `OnboardingWelcome.swift`.
- Era build settings and resolved dependencies: `C:/Users/vauld/Documents/GitHub/Era/Era.xcodeproj/project.pbxproj`, `project.xcworkspace/xcshareddata/swiftpm/Package.resolved`.

Paths following an Edixa or Era prefix are relative to that application's root above.

## Patterns to carry into the fitness app

1. Use Edixa's Expo/TypeScript family for shared iOS, Android, and browser UI. Keep the browser review surface available without native purchase modules. A native development/store build is required to validate actual in-app purchases.
2. Keep RevenueCat behind one adapter: initialize once, load real offerings, purchase, restore, observe customer information, and refresh on foreground. A missing key or unavailable native module must produce an explicit unavailable state, never a pretend successful purchase.
3. Adopt Era's product-derived purchase presentation. The store determines localized price, renewal period, and introductory-offer eligibility. Keep selected product identity separate from display labels; calculate savings only when valid comparable products exist.
4. Align RevenueCat's app user ID with the authenticated account's immutable server ID. Allow local training before optional cloud account creation; bind purchases to the signed-in ID when an account exists.
5. Persist profiles, plans, sessions, exercises, sets, check-ins, and entitlements in a server database. Persist the active workout locally before network synchronization so interrupted connectivity does not lose sets. Use client-generated mutation IDs to make retries idempotent.
6. Use authenticated server routes for personal training data, and scope every data query to the verified account. Edixa's account/device headers are not proof of identity and should not be reused as authorization for private fitness records.
7. Keep subscription truth on the server for paid server features. Authenticated RevenueCat webhooks update an entitlement ledger; reconciliation repairs delayed or missed events. Retain event IDs and timestamps to prevent duplicate or older events overwriting newer state.
8. Make onboarding answers useful immediately: goal, experience, available equipment, training days, and session length should change the resulting plan. Save progress, support going back, reveal the actual plan before optional paid features, and avoid invented testimonials or artificial analysis waits.
9. Use centralized design tokens and shared screen/interaction primitives. Carry the consistency of Edixa's scaffold and Era's focused onboarding, while creating an original fitness identity. Motion should respect the user's Reduce Motion setting.

## Details not to copy blindly

- Edixa's device binding is explicitly documented as noncryptographic, and its error branch allows the request through. This is unsuitable as the sole protection for private training data.
- Edixa's inspected webhook handler does not record event IDs or ordering. Its entitlement function classifies both `CANCELLATION` and `EXPIRATION` as terminal; the new application should evaluate actual entitlement expiry and billing state rather than assuming cancellation immediately ends already-paid access.
- Edixa schedules a trial reminder based on an introductory price being attached to the product. Era's customer-specific eligibility checks are the better model for trial presentation and reminders.
- Edixa's entrance helper explicitly uses `ReduceMotion.Never`; the new app should follow the OS preference.
- Neither existing app's public identifiers, product IDs, endpoints, customer data, nor branding should be reused for the new app. It needs its own store records, RevenueCat project configuration, and database deployment.

## Release boundary

Source wiring can be implemented locally. Production readiness additionally requires the new app's signed native builds, store products, RevenueCat offering and entitlement configuration, webhook secret, hosted database/API, real-device purchase and restore testing, and deployment verification. An interactive local preview alone does not establish those external services as live.
