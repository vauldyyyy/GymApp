# FORMA

**Made for your momentum.** An Expo / React Native training app for iOS, Android and web, with an independently runnable authenticated API.

## Review the app

The development preview runs at [localhost:8081](http://localhost:8081). The API runs at [localhost:4000/health](http://localhost:4000/health).

Start both in separate terminals from this folder:

    npm install
    npm run web

    cd server
    npm install
    npm start

Node 22.13+ is required by the local SQLite API. Everything needed for local training runs without account or billing credentials. Registration and sync use the local API. Development test accounts are local only; no registration emails are sent.

## What is implemented

- Original FORMA brand, app icon, editorial photography, warm ivory/sage design and responsive navigation.
- Animated onboarding with explicit goal, experience, equipment, 2–5 training days and time choices, an optional name, a live plan preview and a membership choice after the reveal.
- A deterministic personalized weekly plan composed from 40 exercise guides, with equipment filtering, recovery-aware scheduling, per-exercise prescriptions and estimated session lengths.
- Workout logging with editable weight/reps, converted previous values, rest timers, safe exercise swaps, saved session recovery, and partial completion.
- Real workout history, eight-week charts, total volume, personal bests and kg/lb conversion. No seeded progress or invented fitness metrics.
- Guest mode, private authenticated accounts, automatic sync, offline-safe caches, conflict handling and recovery copies.
- Account data export, password-confirmed account deletion and training reset.
- RevenueCat native and web offers, checkout, restore access and membership management. Plus adds adaptive planning, progression suggestions, custom routines and unlimited saves. A labeled local preview lets you review Plus without payment; real checkout requires configured provider products and public SDK keys.
- Coach explains adaptations using completed sessions and logged sets. Studio supports creating, editing, duplicating and deleting routines with exercise order, sets, reps and rest, plus account-owned local storage and authenticated sync.
- SQLite for local development; a working PostgreSQL adapter, migrations, authenticated RevenueCat webhook, Dockerfile and production environment validation.

## Verification

    npm run typecheck
    npm test
    npm run build:web
    npm --prefix server run typecheck
    npm --prefix server test
    npm --prefix server run build

The current checkpoint passes 28 app tests, 15 API tests and both TypeScript checks. See [the checkpoint review](docs/checkpoint-2026-09-12.md) for the latest browser coverage. Web and native JavaScript exports are build checks, not signed APK/IPA builds or real device billing validation. See [verification.md](docs/verification.md) for earlier checks.

## Native devices and production

Copy .env.example to .env and configure the API URL and RevenueCat public SDK keys for this new app. Browser checkout uses EXPO_PUBLIC_REVENUECAT_WEB_KEY with configured RevenueCat Web products; see the subscription setup notes. Physical devices need a reachable LAN or hosted API URL; localhost on a phone refers to the phone. Keep backend secrets in server/.env or your host's secret manager.

    npm run android
    npm run ios

iOS native compilation requires macOS/Xcode. Android compilation requires the Android toolchain. EAS preview and production profiles are included for a configured Expo account. No cloud build, store publishing or paid service has been provisioned.

Production deployment needs a PostgreSQL database, HTTPS API host, explicit allowed origins, FORMA store products/offerings/entitlement, RevenueCat webhook secret, signing and native device testing. Email verification and password recovery are not implemented; an email provider and the corresponding flows are required before public account launch.

The catalog is intentionally an initial collection. Nutrition tracking, community messaging, health-device integrations, AI coaching and video/3D exercise demonstrations are not implemented or advertised as functional.

## Project guide

- App.tsx: app shell, navigation and membership lifecycle.
- src/components: onboarding, workout session, dialogs and shared UI.
- src/screens: Today, plan, explore, profile, progress, Coach and routine Studio.
- src/data.ts: exercise catalog and plan/session calculations.
- src/store.tsx and src/lib/sync.ts: durable state, account ownership and conflict handling.
- src/lib/purchases.native.ts / purchases.web.ts: platform-specific billing.
- server: authentication, database, sync API and webhooks.

## Review and setup notes

- [Competitor review](docs/competitor-review.md): Fitness Online, Hevy, Fitbod and Ladder, with official sources and separately identified observations from the supplied PDF.
- [Design system](docs/design-system.md)
- [Reference architecture](docs/reference-architecture.md): what was learned from Edixa and Era; no credentials copied.
- [Backend and API](docs/backend-setup.md)
- [Subscriptions](docs/subscriptions.md)
- [Native readiness](docs/native-readiness.md)
- [Dependency audit](docs/dependency-audit.md)
- [Generated photography and final prompt](docs/asset-notes.md)

FORMA is a working product name; trademark and store-name availability have not been established.

