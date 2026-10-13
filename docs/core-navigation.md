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
