# Logical collection row entry

The C++ `Collections` API supports two policies when an Up/Down move crosses
between horizontal rails in the same outer column collection:

- `CollectionRowEntry::nearest` preserves the source's logical column, choosing
  the nearest eligible order with the existing deterministic tie break. This is
  the default, including for existing aggregate-initialized datasets.
- `CollectionRowEntry::first` chooses the lowest eligible logical order in the
  selected target rail. A disabled first item is skipped. The destination can be
  unmounted and follow the normal realization protocol.

Set `rowEntry` on the outer column's `CollectionNode`, not on each item or rail.
Publish the change with a newer `DatasetRevision`. Invalid enum values and
nondefault declarations outside an outer column reject atomically. A successful
policy revision invalidates affected pending collection work through the existing
transaction contract; it does not move observed host focus by itself.

This option changes the item chosen inside the target row. The existing resolver
still decides which region can be entered, respecting scope activity, readiness,
boundaries and input ownership. Explicit directional overrides retain priority.
Horizontal moves and explicit keyed/restoration requests keep their own contracts.
There is no new row-skipping, wrapping or scroll-alignment policy.

The [React Native rails option](../packages/itar/virtualization.md) forwards this
policy on Android, the cooperative tvOS adapter and the browser Wasm probe.
Neither the C++ capability nor transport validation establishes screen-reader movement or
physical-device support. Visual anchoring remains owned by the list/host adapter.

Adapters that already publish the registry atomically can use
`validCollectionNodes` and `proposeCollectionEntry` without transferring registry
ownership. The projection and its parallel handles must describe the same
committed registrations; generation checks reject retired identities. Native
`Collections` uses these same validation and selection functions.
