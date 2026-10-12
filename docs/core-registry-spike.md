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
