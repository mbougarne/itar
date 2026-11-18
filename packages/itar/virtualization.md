# Fixed-extent list reference

[العربية](virtualization.ar.md) · [Complete catalogue example](../../docs/guides/collections.md)

`FocusVirtualizedList` and `FocusVirtualizedRails` from `itar/react` wrap the TV fork’s `FlatList` using `additionalRenderRegions`, `CellRendererComponent` and `getItemLayout`. One active collection tree fits in each provider. Each tree supports up to 256 logical nodes, including list and row scopes, and up to two list levels. Other targets also consume the surface’s capacity. Native keys, including their encoding, have a 512-byte limit.

| Setting | Usage |
| --- | --- |
| `itemExtent`, `rowExtent`, `viewportExtent` | Supply fixed sizes in layout units including spacing. A horizontal item uses width, a vertical item uses height. Each rail may override its item extent. Variable-size cells, separate insets and arbitrary virtualizers require another integration. |
| `renderItem(item, index)` | Provide presentation inside the single focus host. The index is local to a rail or list. Return `null` to use the text label. Without this callback the list uses `item.children`. Keep keys, semantics and activation on the collection item. |
| `rowEntry` | `nearest` (default) chooses an eligible item near the previous logical column. `first` enters at the first eligible item in the destination rail. Both can require mounting an offscreen cell. |
| `horizontalAlignment` | `nearest` scrolls enough to reveal a target. `leading` aligns the confirmed target with the start of the viewport, left in LTR and right in RTL, as far as the content bounds permit. Applies to horizontal rows. |
| `listHeader` | A focusable leading row needs `listHeaderExtent`, a unique `listHeaderScope` and `listHeaderItems`. Render that scope and its declared focusable items inside a horizontal `ScrollView` directly under the catalogue scope. Include spacing in the height. |
| `active`, `onReady` on rails | An inactive collection releases logical ownership, retaining the mounted viewport. On return, wait for accepted data before requesting the opener. |

Publish immutable data and give each occurrence a stable ID across reorder or append. The mounted list uses the last accepted dataset until a new revision is ready. A presentation-only change can preserve mounted hosts and focus identity.

An offscreen request keeps the source and target render regions for the operation, realizes the outer row before its item, then waits for measured native geometry and confirmed focus. The native scroll chain has one original three-second deadline. Held repeats can join the pending destination. Reversal and newer commands start from observed focus. If the app deletes the currently focused view first, the OS can select an intermediate target. Preserve the source during a handoff when possible. [Request lifecycle](../../docs/guides/architecture.md#follow-one-offscreen-move)
