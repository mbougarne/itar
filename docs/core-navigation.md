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
