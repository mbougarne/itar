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

`itar-linear-v2` requires both directional edges to advance strictly in the
physical direction. A changed center inside an overlapping region is insufficient:
a wider editing row below must not become a Right destination for a keyboard row.
This eligibility refinement is versioned because it changes winners; ranking is
otherwise unchanged. Rank
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
Preferred occurrence keys live in bounded cold registry storage. A scope can name
an unmounted/new child in the same atomic batch, and preference survives that
child's mount or node replacement. Omitted updates preserve it; empty keys clear
it. Preference-only changes participate in revision/change publication. Value
copies may allocate; staging contains allocation failures. Availability
observations and selection copy no preference strings.
An unavailable configured preference yields `no_entry` on first entry, rather
than choosing unrelated default content while it loads. Returning entry retains
its declared history/preference/order fallback.
Adjacent entry ignores history/preference and minimizes distance to the value
anchor (x for up/down, y for left/right); absent measured candidates fall back to
logical order and reveal. No anchor means derive it from fresh source geometry.
`core.navigation_entry` tests precedence, invalid history, readiness, anchor,
empty entry and the integrated move between two rails.

## Committed deletion recovery (ITAR-0034)

Capture value-only occurrence/order and nearest-first scope identities before the
related batch; capture may allocate, while resolution does not. Query only after
that revision commits and host observations reconcile. Current managed focus
suppresses recovery; unmanaged/unknown states cannot stand in for confirmed
absence. The same logical key surviving unmount or replacement suppresses deletion
recovery. Authority loss rejects it. True deletion chooses the nearest eligible
successor, then predecessor in the surviving original scope, then returning entry
in that scope and surviving ancestors. An unavailable result makes no host-focus
claim. `core.navigation_recovery` tests one-batch replacement, temporary detach,
neighbor precedence, current host reassignment and lost authority.

## Cross-policy fixtures (ITAR-0035)

`core.navigation_scenarios` records source, physical direction, destination, kind,
reason and `itar-linear-v2` for nested rails/sidebar and irregular trapped controls.
An inactive route has a deceptively near rectangle but cannot win. Forward/reverse
batch registration yields the same occurrence destination. Thirty repeated queries
per case preserve every record, revision, both focus channels and scope histories;
the fixture's allocation counter observes zero query allocations. Separate cases
check unready/empty regions, scope overrides, malformed policy rejection and a
replaced target whose stale generation must never be returned as ready. Ordered
region traversal shares entry eligibility with geometric region bounds.

This layer does not integrate with the disposable native probes. It implements
no focus dispatch, native styles, gestures, accessibility reader behavior or TV
support. Those acceptance gates remain in native adapter/device tickets.

Review scope: seven independently reviewable ticket slices in the user-requested
single PR. ITAR-0035 exceeds the 250-line target because the assembled fixtures and
shared readiness/generation guards are reviewed together; it remains below 500.
No generated/native files, locks, dependencies or CI requirements changed.

## Local verification (2026-10-13)

CMake 3.31.6 / Apple Clang 21.0.0 on the connected Mac; Node 22.14.0 /
npm 10.9.2. Logs and generated reference projects are retained under this
worktree's ignored `build/` and `apps/probe/{android,ios}/` directories.

| Check | Result |
| --- | --- |
| Release configure/build + CTest | 19/19 pass; `build/final-release-tests.log` |
| `-Wall -Wextra -Wpedantic -Werror`, ASan/UBSan | 19/19 pass; no sanitizer findings |
| `BUILD_TESTING=OFF` library build | Pass |
| Android arm64 core build, NDK 27.1.12297006/API 24 | Pass; compile evidence only |
| tvOS simulator arm64 core build, SDK 27.0 | Pass; compile evidence only |
| RN build/typecheck/lint/test + Android Metro bundle | Pass; both workspace tests pass |
| Android consumer `assembleDebug assembleAndroidTest lintDebug` | Pass, JDK 17.0.14 / Gradle 9.0.0, one worker; `build/android-consumer.log` |
| Manual `npm audit --audit-level=high` | Failed: 27 high / 5 moderate, same two baseline advisory roots |
| Architecture SHA256 | `d3c8147c5e18e24a0ea6c840a247f57a3b7bb7699dbcf262ff20862dcca39915`, unchanged |

Reproduce core checks with the commands in [core/README](../core/README.md),
using separate build directories per configuration. The sanitizer configuration
also adds the strict-warning flags above. `npm audit` remains outside Actions;
no check is suppressed. Physical Android TV/Fire TV/Apple TV, TalkBack/VoiceView/
VoiceOver, host focus/style behavior, input latency and device benchmarks are
unrun here. These pure core fixtures do not establish those capabilities.

ITAR-0033 also includes the stable-preference follow-up: bounded cold keys, atomic
publication and replacement/clear/rejection fixtures are one cohesive entry
contract. Together with ITAR-0029 ownership API/fixtures and local ticket evidence,
these slices exceed the 250-line target and remain below the 500-line ceiling.
