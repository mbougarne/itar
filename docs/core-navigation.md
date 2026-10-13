# Read-only navigation (ITAR-0029–0035)

The independent engine proposes destinations from one committed snapshot on its
serialized owner. Proposals contain value handles, source/mount identity, surface,
authority, revision and policy identifier. They authorize no future host operation;
Phase 06 must revalidate them. No host callbacks, measurements, effects, requests
or notifications exist in this selection layer.

## Ownership and eligibility (ITAR-0029)

Text, native control, system and accessibility ownership return `host_owned`.
Unmanaged observed input focus also belongs to the host. Unknown/absent focus,
stale source/mount or surface, inactive authority and disabled ancestry reject
movement. A logical target can require reveal; only fresh, visible measured
geometry supplies `ready` and a live mount generation. Querying never updates
focus or history. `core.navigation` verifies these rules and repeated-query purity.

## Overrides and boundaries (ITAR-0030)

Overrides name generation-checked targets and resolve exactly one hop; reciprocal
links cannot loop. Invalid/self targets fail explicitly; inactive or trapped-out
targets cannot win. Missing overrides allow ordinary selection. Stop is default,
wrap is opt-in, and parent continuation is explicit. Authority/trap boundaries
prevent escape. Stable order compares declared order then occurrence-key bytes,
never storage slots. `core.navigation_boundary` covers these outcomes.

## Logical order (ITAR-0031)

Rows use physical left/right; columns use up/down. Increasing declared order is
right/down, except explicitly RTL rows where it is left. Disabled/deleted entries
are skipped; unmounted entries retain their place and require reveal without
invented geometry. Endpoints stop or wrap to the eligible opposite endpoint.
Parent continuation is bounded by registry size. `core.navigation_order` includes
19→unmounted 20, reverse registration order, RTL, columns, deletion and wrap.

## Provisional geometry (ITAR-0032)

`itar-linear-v1` admits centers strictly forward in the physical direction. Rank
lexicographically by `(forwardGap + 2*perpendicularGap + perpendicularCenter/4,
forwardGap, perpendicularCenter, declaredOrder, occurrenceKey)`. Gaps are edge
distances clamped to zero; perpendicular overlap makes its gap zero. Unequal
sizes use their measured edges and centers. This is an Itar policy, with no
platform-equivalence or performance claim. Changing winners requires versioning.

Each sibling scan retains one winner. Child-region bounds are the union of fresh
eligible descendant geometry (a bounded scan per region, no cached host measures).
No stale, clipped, inactive or wrong-direction rectangle can win. Spatial wrap
chooses the opposite physical edge, then perpendicular gap/center and stable order.
`core.navigation_geometry`: source `(0,0,10,10)`, right aligned `(20,0,20,20)`
scores 11.25; diagonal `(12,25,10,10)` scores 38.25; distant aligned `(100,0,10,10)`
scores 90. Identical aligned candidates tie by key `a` before `b`, including
reversed registrations. Invalid publication and stale source fail explicitly.

## Explicit scope entry (ITAR-0033)

Entry is an explicit query, never triggered by registration. First entry requires
confirmed absence and respects readiness/preference. Existing managed focus
suppresses late first entry; existing eligible focus in a returning scope also
suppresses redundant restoration. Return tries valid remembered occurrence, then
preferred, then eligible declared order/key. Nested unready scopes are excluded.
Adjacent entry ignores history/preference and minimizes distance to the value
anchor (x for up/down, y for left/right); absent measured candidates fall back to
logical order and reveal. No anchor means derive it from fresh source geometry.
`core.navigation_entry` tests precedence, invalid history, readiness, anchor,
empty entry and the integrated move between two rails.
