# Dependency audit — 12 September 2026

Scope: the root Expo app's npm dependency tree. This is a dependency audit, not a complete application security assessment. The server has its own dependency manifest and validation.

## Changes

- Kept Expo **54.0.37**, React Native **0.81.5**, and React **19.1.0**.
- Pinned the Metro family coherently to **0.83.8** through root npm overrides. This is a patch update from 0.83.3. The official [Metro 0.83.8 release](https://github.com/react/metro/releases/tag/v0.83.8) specifically replaces the vulnerable `image-size` dependency with corrected vendored parsers. The previously installed `image-size@1.2.1` is no longer in the root tree.
- Pinned PostCSS to **8.5.28**, remaining within major version 8. This replaces 8.4.49 and addresses the reported CSS/source-map advisories, including [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp). The version and dependency metadata were verified against the npm registry.
- Updated `package-lock.json` with `npm install --ignore-scripts`. No forced audit fix or major Expo/React Native upgrade was applied.

## Results

| Check | Result |
|---|---|
| Initial root npm audit | 16 affected package nodes: 9 high, 7 moderate |
| Final root npm audit | 10 moderate package nodes; 0 high, 0 critical |
| `npm ls --all` | Successful; no dependency-tree problems |
| `npx expo install --check` | Dependencies are up to date |
| `npm run typecheck` | Passed |
| Isolated web export | Bundled successfully with Metro 0.83.8 into `tmp/dependency-audit-web` |

Audit counts include affected dependants, so the remaining ten nodes do not represent ten distinct advisories. A native Android/iOS compilation was not performed as part of this bounded audit.

## Remaining constraint

The remaining findings all trace to **`uuid@7.0.3` through `xcode@3.0.1`** in Expo's configuration/prebuild tooling. The [uuid advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) concerns missing bounds validation for caller-provided buffers in the `v3`, `v5` and `v6` APIs. Its first patched release on the older supported line is 11.1.1; there is no patched version on major 7 in the current registry data.

The installed `xcode/lib/pbxProject.js` imports `uuid` and uses only `uuid.v4()` in `generateUuid`. The advisory explicitly distinguishes `v4` as already checking bounds. This reduces exposure in the inspected call path; it does not make the vulnerable dependency disappear or replace a full reachability assessment.

A uuid 7→11 override crosses major versions outside the bounded nonbreaking-remediation scope, so it was deliberately not forced. Resolve the remaining advisory when upstream Expo/xcode adopts a patched dependency, or undertake a separately validated targeted override with native prebuild/build coverage. Keep these overrides under review when upgrading Expo, because its Metro version pins may change.
