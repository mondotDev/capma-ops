# Firebase Read Slice Guardrails

## Current state

- Dashboard is the only Firebase-backed read slice.
- Dashboard uses a narrow read-only projection and a session-fixed local-or-remote decision.
- Action View, Collateral, Settings, and all writes remain local-first through `AppStateProvider`.

## Why the app stops here for now

The app is still `local-write / remote-read`. That asymmetry is safe for Dashboard because Dashboard is informational. It is not safe yet for workflow surfaces that the user edits directly.

Do **not** add a second Firebase-backed read slice until there is an explicit read/write coherence policy for mutation-heavy screens.

## What must stay local for now

- Action View list
- Action View detail drawer
- Collateral workspace
- Settings / event program scheduling
- all item writes and issue lifecycle actions
- local persistence and `AppStateProvider`

## What must be decided before a second slice

1. If a screen is remote-backed, what should the user see immediately after a local edit?
2. Should a mutation-heavy screen pin to local for the rest of the session after any local write?
3. Can list and detail ever use different data authorities?
   - Default answer: no
4. What is the eligibility rule for a non-dashboard screen to use remote reads at all?

## Anti-patterns

- adding a raw Firebase `items` read just because Action View is the next obvious screen
- adding another broad projection document for operational work
- letting a new screen invent a de facto canonical Firestore schema before write strategy exists
- mixing remote list data with local detail or local mutations on the same work surface

## Likely next candidate later

If the coherence policy is defined and validated, the next candidate to revisit is:

- Action View list only

Even then:

- not the drawer/detail path
- not Collateral
- not Settings
- not multiple screens in one slice
