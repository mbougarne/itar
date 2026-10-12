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
