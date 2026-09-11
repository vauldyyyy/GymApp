# FORMA checkpoint — 12 September 2026

This checkpoint adds explicit onboarding choices, composed training plans from 40 exercises, a visible Free/Plus membership flow, history-based Coach adjustments and a custom-routine Studio. Annual and monthly membership options use RevenueCat offerings when configured. Development on localhost also supports a clearly labeled Plus preview without charging or granting a paid entitlement.

## Verified in this checkpoint

- App TypeScript and server TypeScript checks passed.
- All 28 app tests and all 15 API tests passed.
- The Codex browser journey covered onboarding, the membership choice, activation of the labeled Plus preview, and custom-routine creation and workout logging.
- The reviewed routine session recorded five completed sets and 456 kg of volume from the entered values.
- Routine sync enforces authenticated ownership, conditional updates and paid access, with a restricted development preview path. Routine data is included in account export and removed with account deletion.

The browser journey used local test data. Earlier verification and export results remain in verification.md; those historical export results should not be read as a fresh native build of this checkpoint.

## Remaining release setup

Live billing remains unconfigured. Provider accounts, real products and prices, public SDK keys, store agreements, payment-provider configuration and a deployed webhook are required before collecting revenue. The local preview is only for reviewing paid features.

No signed APK/IPA, physical-device purchase test, hosted production API or live PostgreSQL deployment was completed. Email verification and password recovery also remain required before public account launch. Adaptive planning is deterministic and uses recorded training; it is not a connected AI coaching service or a health-device analysis.
