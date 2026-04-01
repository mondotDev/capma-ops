# Read/Write Coherence Policy for Work Surfaces

Mutation-capable screens must use a single authority per session.
Dashboard is the only remote-read-only surface today.
List and detail must not split authority.
Mutation screens remain local until reads and writes can move together.

**Clarification:** Mutation-capable screens remain local until reads and writes can move together.

**Clarification:** Dashboard may show session-stale data and is not required to reflect in-session mutations.

## Policy Summary

- A mutation-capable screen must use one authority for both reads and writes for the entire session.
- Dashboard is the only approved remote-read-only surface today.
- Action View, Collateral, and Settings remain local-authority surfaces until the expansion gate in this policy is met.
- A screen must never read from remote while writing to local if the user expects immediate visual confirmation on that same screen.
- List and detail for the same work surface must use the same authority during the session.
- After any local mutation, the user must immediately see the result on the same surface from the same authority.
- Remote-backed operational screens are not allowed until the repo can define exactly what happens after the first local mutation.
- Projection-based Firebase reads are allowed only for informational surfaces that tolerate session-fixed data.
- Cross-screen dependency is a blocker: if a screen's edits drive another active work surface, it stays local until coherence is explicitly solved.
- When in doubt, prefer local authority over mixed authority.

## Screen-by-Screen Authority Model

### Dashboard

- Current authority: local or remote, chosen once at session start.
- Why this is correct: Dashboard is informational, aggregate-heavy, and does not host mutations directly.
- Remote reads allowed: yes, under the existing fixed-session Firebase dashboard slice.
- What must change before it moves further: nothing immediate; the current model is acceptable because Dashboard can tolerate session-fixed remote reads.

### Action View

- Current authority: local only.
- Why this is correct: Action View is a single operational surface with a live list, detail drawer, inline edits, bulk edits, delete/cut, Quick Add effects, issue actions, notes, and routing into related work.
- Remote reads allowed: not yet.
- What would have to change before it could move:
  - a formal post-mutation rule for what the user sees after any local edit
  - a same-authority guarantee for list and drawer
  - a clear eligibility rule for when Action View can be remote for a session
  - explicit handling for issue-open/generate flows and bulk edits

### Collateral / Event Instance Workspace

- Current authority: local only.
- Why this is correct: Collateral is highly mutation-capable and context-sensitive, with drafts, item edits, template apply, profile changes, event instance creation, and active instance state.
- Remote reads allowed: not yet.
- What would have to change before it could move:
  - a policy for draft state versus remote source state
  - a same-authority guarantee for workspace list/detail/context
  - explicit rules for template apply and create-instance visibility after mutation

### Settings

- Current authority: local only.
- Why this is correct: Settings edits drive durable local behavior across other screens, especially schedules, defaults, reset/import, and program configuration.
- Remote reads allowed: not yet.
- What would have to change before it could move:
  - a repo-wide decision on whether configuration edits are local session state or shared remote state
  - a consistency rule for downstream screens that depend on those settings
  - write-path strategy, which is currently out of scope

## Mutation Coherence Rules

### General Rule

- On any mutation-capable screen, the user must see the mutation reflected immediately from the same authority that accepted the mutation.
- If the write is local, the read on that surface must also be local for that session.
- Mixed authority is not allowed on mutation-capable surfaces.

### Quick Add

- Result must appear immediately in Action View from local state.
- This keeps Action View pinned to local authority.

### Inline Status Change

- Updated row, counts, urgency state, and drawer state must update immediately on the same local surface.
- A remote-backed list with local status writes is not allowed.

### Delete / Cut

- Removed or de-emphasized item must change immediately in the visible work surface.
- Any screen performing delete/cut must remain local-authority.

### Bulk Edit

- All affected rows must update immediately and consistently.
- Bulk mutation is incompatible with a remote-read list unless writes also land on that same authority, which they do not today.

### Issue Open / Issue Lifecycle Actions

- Generated items, issue status, and resulting focused work must appear immediately in local state.
- Because this changes operational workload directly, the affected work surface must remain local.

### Collateral Item Update

- Updated collateral item, deadlines, and related workspace context must reflect immediately in the same workspace.
- This keeps Collateral local.

### Template Apply

- New generated collateral items must appear immediately in the active event-instance workspace.
- Template apply cannot coexist with remote-read-only workspace behavior.

### Create Instance

- Newly created event instance must appear immediately in the current workspace/control flow.
- This requires local authority.

### Settings / Program Edits

- Schedule/default changes must be visible immediately where they are managed.
- Because those changes influence other surfaces, Settings remains local until broader coherence is explicitly solved.

### Pinning Rule

- Mutation-capable screens do not switch back after mutation because they never become remotely authoritative under the current policy.
- If a future mutation-capable screen is ever allowed to start remote, the first local mutation must pin the whole surface to local for the remainder of the session unless and until a stronger coherence model is implemented.

## List/Detail Consistency Rule

- List and detail for the same work surface must never use different authorities in the same session.
- In this repo, Action View list and drawer are one operational surface, not two independent screens.
- Collateral workspace list, active instance context, and detail/edit flows are also one operational surface.
- Splitting list and detail authority would create user-visible contradictions:
  - a list that does not match the drawer
  - edits that appear to not stick
  - selections that point at stale rows
  - generated or deleted items appearing in one pane but not the other
- This is a hard rule, not a preference.

## Expansion Gate for Future Firebase Slices

A second Firebase-backed read slice is allowed only if all of the following are true:

- The screen can explain exactly what the user sees immediately after every supported local mutation.
- Reads and writes for that surface can stay on one authority for the session.
- List and detail for that surface can stay on one authority for the session.
- The screen does not depend on local draft state or generated local side effects that must appear immediately unless those behaviors are explicitly solved.
- Remote eligibility is defined before implementation, not during it.
- Fallback to local is deterministic and session-stable.
- The slice does not require inventing a broader Firestore schema just to make the screen work.
- The slice can be validated without changing Action View, Collateral, Settings, or AppStateProvider behavior outside that screen.

Expansion must be blocked if any of these are true:

- We cannot describe post-mutation behavior in one sentence.
- The screen would read from remote and write to local.
- The screen would split list and detail authority.
- The screen needs local writes to appear immediately but remote is still the source of visible rows.
- The slice would force broader schema or provider redesign.

## Risks and Anti-Patterns

### Failure Modes This Policy Prevents

- Action View rows staying stale after inline edits or deletes.
- Drawer content disagreeing with the visible list.
- Issue-open or template-generation actions creating local work that the current screen does not show.
- Collateral drafts or template outputs appearing inconsistent with the visible workspace.
- Settings changes producing unclear downstream behavior across screens.

### Anti-Patterns

- Treating Action View list as read-only enough.
- Allowing a mutation-capable surface to read remote and write local.
- Allowing list and detail to diverge by authority.
- Expanding projection documents as a substitute for a coherent operational source model.
- Moving Settings remote before deciding whether schedules/defaults are shared configuration or local session behavior.
- Letting screen-level convenience override same-authority rules.

### Signs a Proposed Change Violates Policy

- It needs exceptions for most edits.
- It requires explaining why the drawer is correct even when the list is stale.
- It depends on a future write migration to make current UX make sense.
- It introduces remote reads to a screen with drafts, generated items, or bulk edits.
- It cannot be validated without touching multiple screens at once.