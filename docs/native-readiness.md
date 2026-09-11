# Native readiness — 12 September 2026

## Verified locally

Both native JavaScript exports completed successfully using Expo SDK 54, React Native 0.81.5 and the patched Metro 0.83.8 family:

| Command | Result |
|---|---|
| `npx expo export --platform ios --output-dir tmp/ios-export` | Passed: 2,642 modules; 5.61 MB Hermes bundle |
| `npx expo export --platform android --output-dir tmp/android-export` | Passed: 2,640 modules; 5.62 MB Hermes bundle |
| `npx expo config --type public --json` | Passed; iOS, Android and web platforms resolved |

These checks verify native platform module resolution and JavaScript/Hermes compilation. They do not produce an IPA or APK, compile native projects, run an emulator/device, or validate live store purchases.

## Native identity and assets

- The app name is FORMA; the configured iOS bundle identifier and Android package are `app.forma.training`. Registration and availability of those identifiers have not been checked with the stores.
- `assets/icon.svg` is the editable source for the original three orange slanted bars. It was rendered with bundled Sharp into `assets/icon.png` (1024×1024, opaque ivory background) and `assets/adaptive-icon.png` (1024×1024, transparent foreground).
- `app.json` uses the opaque app icon, Android adaptive foreground with the existing ivory background, and a matching web favicon. The rendered icon was visually inspected.
- No additional splash-screen dependency or plugin was introduced. A custom native splash can be configured through the Expo splash-screen plugin when native launch behavior is tested.

The configuration follows the [Expo app-config icon and adaptive-icon fields](https://docs.expo.dev/versions/v54.0.0/config/app/).

## EAS configuration and remaining release work

`eas.json` has an internal preview profile producing an Android APK, a production profile with automatic version increments, and a production submission profile. No EAS project/account linkage, credentials, cloud build or store submission was created in this verification.

Before installing a connected preview on physical devices, set `EXPO_PUBLIC_API_URL` to a device-reachable backend address. The `.env.example` localhost URL refers to the device itself when used in a native build; a deployed HTTPS backend is appropriate for release.

RevenueCat's native integration needs the per-platform public SDK keys, configured store products/offering, and the `forma_pro` entitlement. Validate purchase, cancellation, renewal, account identity changes and restore flows in signed native sandbox builds. Expo Go and successful JavaScript export do not establish billing readiness.

Final release validation still includes actual Android/iOS native builds, installation and interaction testing, launch/icon appearance under OS masks, signing and store metadata, and reachable production account/database services.
