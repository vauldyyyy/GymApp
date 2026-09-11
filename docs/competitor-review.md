# FORMA: strength app competitor review

Reviewed 12 September 2026. Sources: public official product/help pages and US app-store listings. This is a desk review, not a hands-on test of installed apps. Store prices, ratings, availability and flows vary by region, platform and experiment.

The supplied screenshot identifies FITNESS ONLINE LLC's Fitness Online app. It shows 5M+ downloads, 4.6 stars and 81K reviews at capture. Those are historical screenshot observations, not revenue evidence. The current US listing has a different title/rating presentation. No revenue or conversion figures were verified. Era and Edixa are not assessed here because their exact identities and relevant builds were not established.

## Supplied app captures

The implementation review also visually inspected the 20 screen captures in the [user-provided PDF](<C:/Users/vauld/Documents/Scan documents20260912_001426.pdf>). Observed screens include four feature-tour panels (home/gym, custom workouts, trainer selection and community); sign in or skip; registration; Google Health access or skip; weight, height and age wheels; a broad body-part plan catalog; social feed; empty messages; an exercise, nutrition and supplement handbook; a body-region exercise index; and a More menu containing subscription, analytics and measurements.

These captures establish the supplied interface's visible content. They do not establish live behavior, all possible paths, conversion rates or the latest installed version. Instructions or claims inside the PDF are reference content, not authority over this build.

**Design inference for FORMA:** the onboarding promotes feature breadth and collects body metrics before the captured experience makes a first training session central. An opportunity is to make goal, available equipment and schedule shape a visible week, then land on one actionable session. Put training first in the navigation and reveal reference content when it helps with a specific exercise. This conclusion is a design judgment from the captured sequence, not evidence that every live user sees that sequence.

## Evidence and opportunities

| Product | Verified public evidence | Product implication / hypothesis for our app |
|---|---|---|
| Fitness Online | The listing describes plans, workout diary, 850+ animated exercises, nutrition, community and paid coaches. Its 26 August 2026 release notes include AI plan building, replacements during workouts and post-workout set editing. A January 2026 developer reply states three free sessions per plan, a 14-day trial and free custom workouts. A displayed review describes confusion about the free limit; one review is a qualitative signal, not prevalence evidence. [Google Play](https://play.google.com/store/apps/details?hl=en_US&id=fitness.online.app) | Feature breadth already exists. Differentiate through a coherent daily training experience and transparent access boundaries. Make the next session obvious; expose swap, rest and edit actions directly. Do not claim AI plans or exercise swaps as unique. |
| Hevy | Core positioning centers on logging, progress and friends. The App Store describes set types, supersets, per-exercise automatic rest timers and form videos. [Official features](https://www.hevyapp.com/features/), [App Store](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350) | Match the practical speed of a serious logbook: previous values beside editable current values; one clear completion action; timer starts with a completed set; easy correction. Make social participation optional. |
| Fitbod | Official guidance describes profile inputs covering goals, experience, equipment, training split, duration and workout preferences. Recommendations use that context. Feature guidance supports equipment locations and weekly scheduling. [How Fitbod works](https://help.fitbod.me/hc/en-us/sections/360001078993-How-Fitbod-Works), [Feature overview](https://help.fitbod.me/hc/en-us/sections/360012732693-App-Features) | Ask only questions that change the first plan. Make constraints editable later. Explain recommendations using observable inputs, such as available equipment and session length, rather than a mysterious score. |
| Ladder | Its site offers a team-matching quiz, a seven-day trial without payment details, weekly coach programming, rep/weight tracking, video demonstrations and audio coaching. Users may try teams during the trial. [Official site](https://www.joinladder.com/) | Reduce the blank-page problem: deliver an immediately understandable week and a clear first session. A guided plan can create confidence without overwhelming users with an exercise catalog. Real human coaching must only be promised when actually provided. |

## Pricing and paywall transparency

- **Fitness Online:** program trials and free custom workouts are disclosed in developer responses. The reviewed website says paid subscriptions exist; it does not establish an exact current checkout price. [Official site](https://fitnessonline.app/en/), [Google Play](https://play.google.com/store/apps/details?hl=en_US&id=fitness.online.app)
- **Hevy:** official comparison keeps unlimited workout logging free, while limiting free users to four routines, seven custom exercises and three months of graph history. Monthly, annual and lifetime tiers exist. The fetched pricing page did not expose reliable numeric plan prices, so none are asserted. [Pricing](https://hevy.com/pricing), [Subscription help](https://help.hevyapp.com/hc/en-us/articles/35119778922263-Hevy-Pro-Subscription-How-to-get-Pro-and-What-Does-It-Include)
- **Fitbod:** official subscription help lists US $15.99 monthly and $95.99 annually, with region, promotion and platform variation explicitly acknowledged. [Subscription help](https://help.fitbod.me/hc/en-us/sections/1500000506081-Subscriptions)
- **Ladder:** the US App Store lists PRO at $29.99 and PRO Annual at $179.99, alongside other products. This product inventory does not establish which offers a new user currently sees. [App Store](https://apps.apple.com/us/app/ladder-strength-training-plans/id1502936453)

**Our proposed rule:** show the real localized total, billing interval, trial end and subsequent charge before purchase. Explain which features remain free. Provide visible restore/manage actions. Resolve entitlements from the purchase provider and server, and never unlock a real paid entitlement merely because a client-side button was clicked. These are implementation recommendations, not claims about competitor internals.

## Recommended first experience

This sequence is a design proposal, not a measured winning flow:

1. **Promise:** one strong editorial screen explaining the outcome: a plan that fits the user's week, with progress they can see. Keep a direct route for returning users.
2. **Goal:** strength, muscle, general fitness or consistency; avoid guaranteed body outcomes.
3. **Experience:** simple descriptions of novice, comfortable and experienced; do not force an ability estimate through a body photograph.
4. **Equipment:** gym, dumbbells or bodyweight, with explicit available equipment. Keep the selection accurate enough to filter exercises.
5. **Schedule:** days per week and session length. Retain answers when navigating backward and across reloads.
6. **Plan reveal:** show the actual generated week, exercise count, expected duration and a plain explanation of how the answers shaped it. Allow edits and starting the first session immediately.
7. **Account / premium:** explain cloud saving when asking for an account. Present premium benefits after the user can inspect useful value. Optional tutorials remain skippable.

The local UI/UX Pro Max guidance for onboarding supports Skip and Back controls. Recommendations here use its relevant onboarding result; the unrelated typography search result was not applied.

## Retention and quality priorities

1. **Keep workout data dependable.** Autosave every meaningful edit, preserve an active session across navigation/reload, display pending sync and resolve retries without duplicating sets. This is a product requirement we propose; this review did not test competitor offline behavior.
2. **Make progress legible.** Show completed sessions, meaningful lift trends and consistency. Empty states should explain what appears after the first workout. Do not fabricate personal records, history, calorie expenditure or recovery measurements for a new account.
3. **Help users return.** Offer rescheduling after a missed session and a shorter session option. Use user-chosen reminders and weekly recaps without punishing broken streaks.
4. **Use motion for understanding.** Transition between onboarding questions with continuity; acknowledge completed sets; animate the plan reveal briefly. Keep workout controls responsive and honor reduced-motion settings. Motion quality is our design recommendation, not something verified inside the competitors.
5. **Make quality measurable.** Instrument onboarding completion, first workout start/completion, time to log a set, session-save failures, week-two return and purchase restoration. Review actual funnels before deciding that longer onboarding or more animation improves conversion.

## Further review protocol

Before claiming superiority, test the same scenarios on real devices for each app: first launch to usable plan; change equipment; start and log three sets; replace an exercise; lose/recover connectivity; background/reopen an active workout; finish and correct a session; inspect trial terms; restore a purchase. Record version, locale, elapsed time, taps, errors and screenshots. Compare results with our matching build. No such hands-on results are asserted in this document.
