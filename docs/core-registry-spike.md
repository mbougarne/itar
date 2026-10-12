# Portable registry spike (ITAR-0021–0028)

This bounded C++20 state layer belongs to one surface and one serialized owner
thread. It does not call hosts, emit effects, choose destinations, or establish
native platform support. Existing disposable probe tokens remain probe-only;
the independent engine uses distinguished value tokens with the same zero-invalid
convention. No binding API is promoted by this spike.

## Identity (ITAR-0021)

Occurrence keys identify stable entries, not content IDs, array positions or React
sibling keys. `OccurrenceKey::compose(screen, rail, entry)` length-prefixes each
component; delimiters and embedded bytes cannot collapse different tuples.
Applications must supply a distinct stable entry ID for repeated content.
Keys survive unmounts; live node and mount generations do not identify content.
Surface lifetime tokens must not be reused while old callbacks can arrive.
Zero identifiers and empty opaque keys are invalid. Revision zero is the initial
empty snapshot's revision, never a published nonempty commit.

Evidence: `core.identity` checks repeated occurrences, ambiguous delimiters,
reserved values, equality and compile-time separation of token domains.

## Storage (ITAR-0022)

The registry preallocates contiguous slots and a separate key array. Key lookup
is a bounded linear scan in this spike; no index or allocator is justified yet.
Empty slots are reusable until the configured generation ceiling; exhausted
slots retire permanently. Capacity and generation exhaustion have distinct
results. The ceiling is configurable for tests and cannot exceed the token type.
Removal releases keys and records. References are borrowed until the next
mutation or destruction; callers retain value handles across mutation.
Construction and key preparation may throw allocation errors; insertion copies
the key before publishing a record. Transaction resource handling follows below.

Evidence: `core.registry` exercises duplicates, invalid keys, capacity, stale
handles, retirement, and 50 allocation/removal cycles.

## Scopes (ITAR-0023)

Scopes share owned slots with items. Parent links name generational scope handles;
ancestry and effective activity are bounded by registry size. Inactivity propagates
through ancestors. Declared order belongs to each parent; equal order falls back
to stable slot order within this snapshot. These queries have no focus state or
callbacks. The raw registry is a storage primitive; applications use the validated
snapshot boundary below to publish topology.

Evidence: `core.topology` checks nested inactivity, independent scope order and
membership, reparenting, invalid handles and bounded malformed-cycle behavior.

## Final graph validation (ITAR-0024)

One operation per key makes duplicate intent explicit. Replacement is a distinct
operation that retires the old node handle. Deletions run before allocations;
parent keys resolve after all records exist, including untouched children of a
replaced scope. Insert ordering cannot expose intermediate missing-parent errors.
Operations are bounded to twice slot capacity and keys to configured byte length.
Diagnostics retain an operation index when attributable, never an unbounded string.
Validation stages a copy and reports allocation failure without publishing it.

Evidence: `core.batch` covers ordering, duplicate mixed batches, missing parents,
cycles, non-finite/negative geometry, wrong surface/revision and bounded capacity.
This cohesive validator/test slice exceeds the 250-line target (below 500) because
final-graph preflight and its rejection fixtures must be reviewed together.

## Atomic publication (ITAR-0025)

`State::apply` prepares the final graph and changed-handle pairs before a no-throw
snapshot swap. A nonempty accepted batch advances one revision; an empty batch
validates its expected revision without advancing it. Revision overflow rejects
rather than wrapping. Readers run on the same serialized owner and see the old
or new snapshot. Borrowed references expire at mutation; a copied snapshot is
owned independently. Changed pairs include implicit parent-handle updates.
Configured capacity supplies deterministic resource-preflight failure; allocation
failure anywhere in staging or result preparation returns `resource` with no swap.

Evidence: `core.state` tests coherent publication, copied old snapshots, capacity
rejection, replacement/reparenting output, revision exhaustion and empty batches.

## Irreversible host facts (ITAR-0026)

The adapter removes its native mapping first, then reports surface/node/mount
identity. Mount loss preserves logical membership and the last mount token as a
tombstone. Only a strictly newer mount generation can remount that logical node;
replacement also retires its node handle. Geometry invalidation preserves a host
layout watermark that declarative updates cannot lower. Observations do not
advance the declarative revision, emit effects or assert host focus absence.

Evidence: `core.host` uses a fake host mapping, detach before rejected duplicate
batch, prohibited resurrection, remount, old-generation observations, idempotence,
and explicit dirty/unavailable geometry states.

## Geometry freshness (ITAR-0027)

Hosts publish stable navigation rectangles in surface coordinates, tagged with
mount and monotonically increasing layout epochs. Invalidation through epoch N
requires a measurement newer than N, even if a rejected configuration still
contains the old rectangle. Geometry-only publication uses the same atomic batch
path. A dirty/unavailable declarative update also prevents resurrecting its prior
measurement. A new mount resets the per-mount watermark; mount exhaustion requires
logical replacement. Decorative focus transforms are deliberately absent.
`usableGeometry` reads one borrowed snapshot and reports its committed revision;
hidden/clipped states are explicit exclusions, not arbitrary occlusion detection.

Evidence: `core.geometry` tests scroll invalidation, stale epoch rejection,
coherent two-target publication, old snapshots, wrong surface/mount and visibility.
