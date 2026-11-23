# Build a scrollable catalogue

[العربية](../ar/guides/collections.md)

A rail can contain 30 titles while the TV has native views for only a handful. To let the engine select the next *logical* item, declare all 30 items in the collection and let Itar coordinate rendering and scrolling when a cell is offscreen.

Use `FocusVirtualizedList` for a single horizontal or vertical list and `FocusVirtualizedRails` for a column of horizontal lists. Both wrap the pinned TV fork of React Native's `FlatList`. A provider accepts one active collection tree. Combine multiple visible rails under that tree. [Package setup and first screen](integration.md)

## Two rows that share a movie

This example needs no assets or service. Move between the rows, press Select on either copy of *Paper Moon*, and compare the reported keys. The movie identifier is shared across both appearances. Each key identifies the title's position in the catalogue using a stable entry ID.

```tsx
import React, {useMemo, useState} from 'react';
import {Text} from 'react-native';
import {
  FocusProvider,
  FocusVirtualizedRails,
  occurrenceKey,
  type VirtualizedFocusItemRenderer,
  type VirtualizedFocusRail,
} from '@bougarnem/itar/react';

const catalogue = [
  {id: 'featured', entries: [
    {entryId: 'opening', movieId: 'film-7', title: 'Paper Moon'},
    {entryId: 'late-show', movieId: 'film-9', title: 'Night Train'},
  ]},
  {id: 'watch-again', entries: [
    {entryId: 'last-week', movieId: 'film-7', title: 'Paper Moon'},
  ]},
];

const renderTitle: VirtualizedFocusItemRenderer = item => (
  <Text style={{padding: 12, color: '#151515'}}>{item.accessibilityLabel}</Text>
);

export default function Catalogue() {
  const [selected, setSelected] = useState('Choose a title');
  const rails = useMemo<readonly VirtualizedFocusRail[]>(() =>
    catalogue.map(row => ({
      id: row.id,
      items: row.entries.map(entry => ({
        occurrenceKey: occurrenceKey('home', row.id, entry.entryId),
        contentId: entry.movieId,
        accessibilityLabel: entry.title,
        focusStyle: {accentColor: '#006699', backgroundColor: '#bce8ff'},
        onPress: activation => setSelected(activation.occurrenceKey),
      })),
    })), []);

  return (
    <FocusProvider style={{flex: 1, backgroundColor: '#fff'}}>
      <FocusVirtualizedRails
        id="catalogue"
        rails={rails}
        itemExtent={200}
        rowExtent={96}
        viewportExtent={600}
        viewportRows={2}
        rowEntry="first"
        renderItem={renderTitle}
      />
      <Text style={{color: '#111'}}>{selected}</Text>
    </FocusProvider>
  );
}
```

For one row, import `FocusVirtualizedList` and replace the rails component with `<FocusVirtualizedList id="featured" data={rails[0].items} itemExtent={200} viewportExtent={600} renderItem={renderTitle} />`. It defaults to horizontal. For a vertical list pass `horizontal={false}` and use item and viewport heights.

## Size, ordering and presentation

| Setting | What to supply |
| --- | --- |
| `itemExtent` | Full width of a horizontal cell or height of a vertical one, including spacing. A rail can override its item width. |
| `rowExtent` and `viewportExtent` | Row height and horizontal viewport width for nested rails. Size the container to fit the viewport. |
| `viewportRows` | Visible row count, between 1 and 10, default 2. `viewportHeight` can specify the outer viewport's exact height. |
| `rowEntry` | `nearest` selects the nearest eligible logical column when moving vertically. `first` starts at the first eligible title even if its cell needs to be realized. `remembered` returns to the last eligible card observed in the destination row, falling back to its first eligible card. |
| `horizontalAlignment` | `nearest` reveals as much as necessary. `leading` aligns the confirmed title with the start edge, bounded by scrollable content. `pinned` adds trailing space so even the final card can reach that edge. On tvOS, UIKit or VoiceOver selects the card and Itar positions the pinned row. |
| `renderItem` | Receives the item and its index within its row. Return text, an image, a decorative view, or `null` for label mode. If omitted, the cell uses `item.children`. |
| `onReady` on rails | Signals readiness of the active collection's accepted model on native TV. Use it when coordinating a route transition. |

Keep labels, actions and enabled state on the item. The collection wraps the renderer's result in an owned `Focusable` and supplies order and size. An inner pressable would introduce a second control. Treat data as immutable. A change limited to a title's presentation can reuse the accepted logical dataset and native registration.

Extents describe a fixed grid in React Native layout units. The host measures actual cells before applying focus. Variable item sizes, extra scroll insets, transforms and third-party virtualizers need separate integration. See the [collection reference](../../packages/itar/virtualization.md) for rail headers, a leading hero row, LTR/RTL alignment, input ownership, and the supported `FlatList` hooks.

## What happens offscreen

1. The provider publishes a complete logical dataset with occurrence keys and order. The native adapter accepts its revision. Membership survives recycling.
2. A remote move or `focusByKey` names an eligible item. If a view is missing, the engine emits a reveal effect. The collection adds the needed source and destination indices to the normal render window.
3. The host waits for cell commit, scrolls the row and then the item when needed, and measures the current mount. Old preparation from a cancelled request cannot authorize a scroll on its replacement.
4. The host requests input focus. Only the confirmed observation completes the move. The request releases its extra render regions when it settles.

A collection can declare up to 256 nodes, including list and row scopes. For example, two rails with 20 entries each require 43 collection nodes (one outer scope, two row scopes and 40 entries). Other provider children also use native surface capacity. Stay within the native 512-byte key limit including encoding. A nested collection supports two list levels. Itar pins only the request's needed cells in addition to `FlatList`'s own retained window.

If a route remains mounted, `active={false}` on its rails releases catalogue ownership and retains the existing viewport. Reactivation republishes the catalogue. Use a collection's `onReady` and a saved occurrence to coordinate route return. Removing the focused source before a destination is ready may let the host choose another view. Screen readers retain control of accessibility focus and speech. [Route handoffs](integration.md#route-changes-and-accessibility) · [Host confirmation](architecture.md#follow-one-offscreen-move)
