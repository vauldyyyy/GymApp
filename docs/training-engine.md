# FORMA training engine

The engine composes sessions from 40 documented exercises. It is deterministic software: the same profile and completed history produce the same output. It does not call an AI service or claim to measure recovery.

## Plan composition

Equipment and experience first restrict the candidate exercises. Dumbbells alone do not imply access to a bench. A novice bodyweight profile does not receive pike push-ups or the more demanding full push-up variation.

Two or three selected days receive full-body movement coverage. Four days use upper/lower emphasis; a fifth day includes full-body work. Within those constraints, movements are ranked using goal, equipment, experience, earlier exercises in the week, and optional completed history. There is no sequence of fixed workout IDs. Bodyweight plans explicitly acknowledge that light floor upper-back exercises do not replace loaded pulling.

Sets, repetitions and rests are saved as an exercise prescription and carried into the live session, rest timer and history. A user-authored custom routine retains its exact order and prescription.

Duration is an estimate, not the user's selected budget copied into a label. It includes five minutes of preparation, three seconds per repetition, both sides for unilateral exercises, prescribed rest between sets, and 45 seconds between exercises. Mobility-only preparation is one minute. The default plan must fit the budget; custom routines can exceed it and report the resulting estimate.

## Paid adaptation

Only completed sets contribute evidence. History is deduplicated by session ID and sorted by completion time. Without completed training, the adaptive plan uses profile preferences and says it needs a first logged workout.

After a logged session completes today, the next-session shortcut advances to the next selected day. Today's scheduled slot remains available to open manually and appears at the end of the next-seven-days list. This matches the existing weekly count of days with completed training. Empty or unfinished sessions do not complete the day. Dashboard and Coach refresh their calendar state at local midnight and when the app returns to the foreground.

For a session scheduled today, four or more logged sets in a muscle area during the preceding 36 hours limit that area to two sets per exercise. An upper/lower split can prioritize the half of the body with less recent recorded work. The 36-hour window and four-set threshold are transparent product heuristics, **not validated measures of tissue recovery**, and are not applied to a later scheduled day.

A recently incomplete session can reduce the next workout from three sets to two. The app reports how many sets were completed and explicitly avoids assuming why the user stopped. It does not invent readiness scores, calorie expenditure, predicted strength gains or completion dates.

## Progression suggestions and evidence

A load suggestion needs two distinct sessions with all planned sets completed at the same converted load and at least two repetitions above the recorded target on every set. The recorded repetition target and set count must also agree across both sessions. This works with custom targets such as 3 × 15; changing a routine's target resets that comparison. Legacy history without a prescription falls back to the profile's current default.

The suggested increase is 2.5%, rounded to one decimal place, shown for review only. A suggestion is suppressed if rounding yields no increase. The app does not know the user's effort, pain, technique quality or available plate increments. Its copy asks the user to keep the load or choose a smaller available increment if appropriate. Starting a workout uses the user's previous completed load, never the suggestion. Bodyweight and unspecified-equipment movements do not receive external-load increases.

The earlier ACSM position stand recommends context-dependent progression of approximately 2–10% after exceeding a desired repetition workload. FORMA's two-session/all-sets requirement is a conservative implementation choice, and 2.5% is our selected value within that range, not an ACSM-prescribed universal increment. [ACSM 2009 position stand, primary publication abstract](https://pubmed.ncbi.nlm.nih.gov/19204579/)

The 2026 ACSM guidance emphasizes consistent participation, training major muscle groups, and individualization to goals and ability. It notes that complex periodization and training to failure are not consistently necessary for average healthy adults. FORMA therefore keeps its defaults understandable and does not require failure or calculate a one-repetition maximum. This software is not a validated individualized coaching assessment. [ACSM 2026 guideline announcement](https://acsm.org/resistance-training-guidelines-update-2026/)

## Verification

Domain tests cover all 81 combinations of three goals, three equipment setups, three experience levels and three time budgets; movement coverage, equipment constraints, deterministic composition, exact custom prescriptions, actual time estimates, history-based changes, incomplete and duplicate logs, unit conversion, and progression thresholds. UI-level prescription integration additionally carries the same rest duration into the session timer.
