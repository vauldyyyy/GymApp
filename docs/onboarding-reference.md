# FORMA onboarding reference adaptation

Reference: the user-provided **BodBot** recording, [WhatsApp Video 2026-09-12 at 1.03.39 AM.mp4](<C:/Users/vauld/Documents/WhatsApp Video 2026-09-12 at 1.03.39 AM.mp4>), 252.09 seconds, 386 × 850 pixels. Reviewed through an eight-second storyboard of the full recording, one-second opening frames, and selected transitions at four frames per second. Timestamps below are approximate.

The recording is a visual design reference. It does not establish completion rates, retention, revenue, or competitor ranking; those results were not verified.

| Observed in the recording | Adapted for FORMA |
| --- | --- |
| At 3–7 seconds, a wireframe grid wraps into a sphere and resolves toward the app's body/brand visual. | An original FORMA emblem: three slanted orange bars settle inside fine concentric rings with small orbital accents. Its entrance ends within 1.3 seconds; five dots reflect setup answers. |
| At 11–28 seconds, a persistent “Your Projected Regimen” preview uses exercise circles beneath the questions and changes alongside the setup flow. | A live preview uses the existing `buildPlan` output. Desktop keeps the plan beside the questions; phones expose “Preview my plan” in a sheet. The preview reflects actual goal, equipment, days, duration, and experience preferences. |
| At 27–31 seconds, incoming questions move horizontally while floating colored clusters create continuity. | Forward/back question transitions combine a short horizontal movement with fading. Selection icons and checks use a small spring; a five-step indicator preserves orientation. |
| Explanatory coaching text accompanies the questions and projected regimen. | Brief answer feedback explains how a preference affects the plan. The final screen shows the actual first week and offers edits to goal, equipment, and schedule. |

FORMA retains its ivory, charcoal, sage, and orange palette, original imagery, and existing type system. No frames, brand marks, or other assets were copied from the video. Motion supports continuity and feedback; it does not simulate analysis, invent readiness scores, or delay the user with an artificial loading sequence.

The primary action stays available in the normal portrait flow, with an in-scroll layout on short landscape screens. Reduced motion presents settled states. Optional name entry, back navigation, guest exploration, and the returning-member sign-in path remain part of onboarding.

Implementation: `src/components/Onboarding.tsx`, `OnboardingEmblem.tsx`, and `OnboardingPlanPreview.tsx`. Runtime and interaction verification is recorded separately in `docs/verification.md`.
