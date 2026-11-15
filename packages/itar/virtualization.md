# Fixed-extent virtualized lists

`FocusVirtualizedList` and `FocusVirtualizedRails` from `itar/react` wrap the
existing React Native TV `FlatList`. The first integration is restricted to
`react-native-tvos` **0.83.0-0**, including its matching
`@react-native-tvos/virtualized-lists` package. It uses the public
`additionalRenderRegions`, `CellRendererComponent`, and `getItemLayout` hooks
with the normal native scroll view. It does not support arbitrary virtualizers.

```tsx
import {FocusProvider, FocusVirtualizedList, occurrenceKey} from 'itar/react';

const data = entries.map(entry => ({
  occurrenceKey: occurrenceKey('home', 'favorites', entry.id),
  contentId: entry.movieId,
  accessibilityLabel: entry.title,
  onPress: activation => openMovie(activation.contentId),
}));

<FocusProvider style={{flex: 1}}>
  <FocusVirtualizedList id="favorites" data={data}
    itemExtent={180} viewportExtent={720} />
</FocusProvider>
```

Each item is an owned `Focusable` button. Use stable occurrence IDs, including
separate IDs when content repeats. Never derive identity from its array index.
There is one collection tree per provider, at most 256 collection nodes including
list/row scopes, and at most two list levels. Ordinary provider children share the
same surface capacity. Keys remain subject to the native 512-byte limit.

`itemExtent` is the complete fixed width of a horizontal cell or height of a
vertical cell, including any spacing. `viewportExtent` is the list's scrolling
viewport size. Arbitrary insets, separators, transforms, variable cell sizes, and
custom renderers are outside this integration. `itemStyle` can decorate a
button while preserving these dimensions. Keep data immutable between updates.

For nested rails, pass `rails={[{id, items}]}` to `FocusVirtualizedRails`, along
with `itemExtent`, `rowExtent`, `viewportExtent`, and optional `viewportRows`
(default 2). Row IDs and item occurrence keys must be stable and unique. Adjacent
horizontal rails enter at the nearest available logical column; this declared
fixed-column policy does not depend on which cells happen to be mounted.

On the native TV adapters and browser probe, `rowEntry="first"` on
`FocusVirtualizedRails` changes Up/Down entry to the first eligible item in the
destination row. The default is
`rowEntry="nearest"`. Disabled items are skipped; an unmounted first item is
realized instead of substituting a later mounted item. This also applies when
crossing the leading header row. Horizontal movement and explicit keyed
restoration keep their existing behavior. Changing the option publishes a new
dataset and invalidates pending work from the old policy.

The browser probe forwards a validated logical projection to the same C++
selector; DOM measurement and mounting remain browser-owned. On tvOS, the adapter
cooperates with UIKit: an already-correct mounted destination proceeds normally, while a differing owned
vertical row entry is rejected before focus changes and deferred through the
engine's native request/confirmation path. Offscreen items use collection
realization. Default mounted selection remains UIKit-owned. This does not claim
gesture/momentum parity or override VoiceOver navigation. Physical-device and
spoken-reader acceptance remain separate from boundary/simulator tests.

The native virtualized-list probe offers a **Row entry: nearest/first** toggle
after selecting **Nested rails** for manual comparison.

Rails optionally accept one leading row through `listHeader`, `listHeaderExtent`,
`listHeaderScope`, and `listHeaderItems`. The header must render the declared scope
directly under the catalogue scope, with its declared `Focusable` items inside a
horizontal `ScrollView`. It participates in logical membership and source/target
retention like every other row; it is not an unrelated decorative list header.
`listHeaderExtent` includes all vertical spacing. The first row uses that height;
the remaining rows use `rowExtent`. Host-only `leadingExtent` metadata keeps native
reveal offsets aligned with `getItemLayout`; it never substitutes for measured
focus geometry. Home uses this for its Hero so it scrolls with the catalogue.

The provider atomically publishes a complete dataset revision before rendering
its new cells. Until native acceptance, an existing list keeps its last accepted
data. Logical membership survives physical cell unmounting; recycled views attach
with a new mount generation. Removed items, reordered data, route changes and
replacement providers invalidate affected pending work.

An offscreen request prepares source/target render regions, waits for a native
cell commit, then performs a guarded, nonanimated scroll on the UI owner thread.
Nested requests scroll the row before its item. Fixed extents plan offsets only;
actual native measurements and matching mount/dataset/effect identities authorize
focus. The host must confirm actual focus before subscribers or request promises
report success. Late JavaScript preparation cannot scroll a replacement request.

One scroll chain is active per surface, with a three-second original deadline.
On Apple TV it waits for an existing native drag/deceleration to settle within
that deadline; it never extends the request or competes with that motion.
Same-direction repeats join that destination and deadline. Reversal and explicit
commands supersede from actual observed focus; they do not create future moves.
At most source and target indices are request-pinned per list, in addition to the
virtualizer's normal window and its initial-cell retention. Confirmation,
cancellation, timeout, failure and disposal release request-owned regions.

Retention regions are applied lazily by this virtualizer. A committed cell and a
live source are prerequisites for scrolling; they do not establish a universal
pre-removal guarantee. Arbitrary application deletion of the focused source has
no public pre-removal hook and is recovery-only. Gestures, momentum, host fallback
prevention, visual continuity and screen-reader speech require named native
acceptance; they are not established by this API preview. Avoid deleting or
replacing the source during a transfer if preventing fallback is required.

Native screen-reader ownership cancels Itar movement. Semantics are committed
before eligibility; Itar neither forces accessibility focus nor announces a
speculative destination. TalkBack, Fire TV VoiceView and Apple TV VoiceOver
acceptance remain separate device requirements. No physical-device support is
established by a build or simulator result.
