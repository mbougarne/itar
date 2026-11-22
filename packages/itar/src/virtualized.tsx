import React, {memo, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {FlatList, PixelRatio, Platform, StyleSheet, View} from 'react-native';
import type {FlatListProps, StyleProp, ViewStyle} from 'react-native';
import {CollectionContext, CollectionDatasetContext, ScopeContext} from './api/contexts';
import {nativeScopeKey, nativeTargetKey} from './api/types';
import type {CollectionNode, CollectionStore} from './api/collections';
import {Focusable, FocusScope, useFocusState, useScreenReaderEnabled} from './react';
import {headerScrollOffset} from './api/viewport';
import type {Rail, ItemRenderer, ListProps, RailsProps} from './api/component-props';
import type {FocusableProps} from './react';

export type VirtualizedFocusItem = Omit<FocusableProps, 'order' | 'style'>;
export type VirtualizedFocusItemRenderer = ItemRenderer<VirtualizedFocusItem>;
export type VirtualizedFocusRail = Rail<VirtualizedFocusItem, StyleProp<ViewStyle>>;
type FocusRailRow = VirtualizedFocusRail & {key: string};
const supported = Platform.isTV && (Platform.OS === 'ios' || Platform.OS === 'android');
function extent(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value > 1000000) { throw new Error('List extents must be positive and at most 1000000'); }
}
function alignment(value: string) {
  if (value !== 'nearest' && value !== 'leading' && value !== 'pinned') { throw new Error('horizontalAlignment must be nearest, leading or pinned'); }
}
function list(key: string, parent: string, order: number, horizontal: boolean, size: number): CollectionNode {
  return {key, parent, order, scope: true, enabled: true, layout: horizontal ? 1 : 2, extent: size};
}
function items(data: readonly VirtualizedFocusItem[], parent: string): CollectionNode[] {
  return data.map((item, order) => {
    if (!item.occurrenceKey || !item.accessibilityLabel) { throw new Error('Virtualized items require stable occurrence keys and labels'); }
    return {key: nativeTargetKey(item.occurrenceKey), parent, order,
      scope: false, enabled: item.enabled !== false, layout: 0, extent: 0};
  });
}
function useCollection() {
  const store = useContext(CollectionContext);
  if (!store) { throw new Error('Virtualized lists require FocusProvider'); }
  return store;
}
function usePublished<T extends {nodes: readonly CollectionNode[]}>(model: T, active = true) {
  const store = useCollection();
  const [owner] = useState(() => ({}));
  const pending = useRef<{dataset: string; model: T; signature: string} | null>(null);
  const signature = useMemo(() => JSON.stringify(model.nodes), [model.nodes]);
  const [accepted, setAccepted] = useState<{dataset: string; model: T} | null>(null);
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  useLayoutEffect(() => {
    if (!active) { store.remove(owner); pending.current = null; return; }
    if (pending.current?.signature === signature) {
      pending.current = {...pending.current, model};
      if (store.snapshot().accepted === pending.current.dataset) { setAccepted(pending.current); }
      return;
    }
    const dataset = store.publish(owner, model.nodes);
    pending.current = {dataset, model, signature};
  }, [store, owner, model, active, signature]);
  useLayoutEffect(() => () => store.remove(owner), [store, owner]);
  useLayoutEffect(() => {
    if (pending.current?.dataset === snapshot.accepted) { setAccepted(pending.current); }
  }, [snapshot.accepted]);
  if (active && snapshot.rejected) { throw new Error('Native collection publication was rejected; check keys, parent scope and surface capacity'); }
  // Retain the existing virtualized viewport while another route owns the catalog.
  // Its old dataset is ineligible natively; reactivation republishes before entry.
  if (!active) { return accepted; }
  return supported ? accepted : {dataset: '', model};
}

type CellProps<T> = React.ComponentProps<NonNullable<FlatListProps<T>['CellRendererComponent']>>;
function renderer<T>(store: CollectionStore, collection: string, key: (item: T) => string) {
  return function Cell({children, item, onLayout, onFocusCapture, style}: CellProps<T>) {
    const snapshot = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
    const preparation = snapshot.preparation;
    const ready = preparation?.path[preparation.step]?.collection === collection && preparation.key === key(item) ? preparation : null;
    return <View style={style} onLayout={onLayout} onFocusCapture={onFocusCapture}>
      {children}
      {ready ? <View key={`${ready.request}/${ready.effect}/${ready.step}`} collapsable={false} accessible={false}
        pointerEvents="none" style={styles.commitMarker}
        onLayout={() => store.committed(ready, key(item))} /> : null}
    </View>;
  };
}
const ItemList = memo(function ItemListView({data, collection, horizontal, itemExtent, viewportExtent, itemStyle, testID, crossExtent, renderDecoration, renderItem, overlayTarget = false, nestedRow = false, pinned = false, keepWindowAttached = false}: {
  data: readonly VirtualizedFocusItem[]; collection: string; horizontal: boolean; itemExtent: number;
  viewportExtent: number; itemStyle?: StyleProp<ViewStyle>; testID?: string; crossExtent?: number;
  renderItem?: VirtualizedFocusItemRenderer; overlayTarget?: boolean; nestedRow?: boolean; pinned?: boolean; keepWindowAttached?: boolean; renderDecoration?: (item: VirtualizedFocusItem) => React.ReactNode;
}) {
  const store = useCollection();
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const Cell = useMemo(() => renderer<VirtualizedFocusItem>(store, collection, item => nativeTargetKey(item.occurrenceKey)), [store, collection]);
  const crossDimension = crossExtent === undefined ? undefined : horizontal ? {height: crossExtent} : {width: crossExtent};
  const paddingEnd = pinned && horizontal && data.length > 1 ? Math.max(0, viewportExtent - itemExtent) : 0;
  // A non-scrolling row is layout for its cards. Keep the native scroll host
  // for collection reveal, but exclude the row itself from Android focus.
  const fixedRow = nestedRow && Platform.OS === 'android' &&
    PixelRatio.getPixelSizeForLayoutSize(data.length * itemExtent + paddingEnd) <= PixelRatio.getPixelSizeForLayoutSize(viewportExtent);
  return <FlatList data={data} horizontal={horizontal} testID={testID}
    // With leading-edge pinning, the immediately preceding card is offscreen.
    // Keep its native mount usable for reveal while it is in the React window.
    removeClippedSubviews={keepWindowAttached && pinned && horizontal ? false : undefined}
    contentContainerStyle={paddingEnd > 0 ? {paddingEnd} : undefined}
    scrollEnabled={fixedRow ? false : undefined} importantForAccessibility={fixedRow ? 'no' : undefined}
    style={horizontal ? [styles.horizontalViewport, {width: viewportExtent}, crossDimension] : [styles.verticalViewport, {height: viewportExtent}, crossDimension]}
    showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}
    keyExtractor={item => item.occurrenceKey} CellRendererComponent={Cell} extraData={snapshot.preparation}
    additionalRenderRegions={store.regions(collection)} initialNumToRender={2} maxToRenderPerBatch={2} windowSize={3}
    getItemLayout={(_, index) => ({length: itemExtent, offset: itemExtent * index, index})}
    renderItem={({item, index}) => {
      const target = <Focusable {...item} order={index}
        style={[horizontal ? styles.horizontalItem : styles.verticalItem,
          horizontal ? {width: itemExtent} : {height: itemExtent}, itemStyle, overlayTarget && styles.overlayTarget]}>
        {renderItem ? renderItem(item, index) : item.children}
      </Focusable>;
      return renderDecoration ? <View style={horizontal ? {width: itemExtent, height: crossExtent} : {height: itemExtent}}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none">{renderDecoration(item)}</View>
        {target}
      </View> : target;
    }} />;
});

/** Fixed-extent owned buttons using the pinned react-native-tvos FlatList. */
export function FocusVirtualizedList({id, data, horizontal = true, itemExtent, viewportExtent, style, itemStyle, testID, renderItem, crossExtent, horizontalAlignment = 'nearest'}: ListProps<VirtualizedFocusItem, StyleProp<ViewStyle>>) {
  const parent = useContext(ScopeContext);
  const reader = useScreenReaderEnabled();
  const model = useMemo(() => {
    extent(itemExtent); extent(viewportExtent); alignment(horizontalAlignment);
    if (crossExtent !== undefined) { extent(crossExtent); }
    if (!id) { throw new Error('A virtualized list requires a stable id'); }
    const key = nativeScopeKey([...parent.path, id]);
    return {id, key, data, horizontal, itemExtent, viewportExtent, crossExtent, renderItem, horizontalAlignment,
      nodes: [{...list(key, parent.key, 0, horizontal, itemExtent), ...(horizontal ? {horizontalAlignment} : {})}, ...items(data, key)]};
  }, [id, data, horizontal, itemExtent, viewportExtent, crossExtent, parent.path, parent.key, horizontalAlignment, renderItem]);
  const published = usePublished(model);
  if (!published) { return <View style={style} testID={testID} />; }
  const value = published.model;
  return <CollectionDatasetContext.Provider value={published.dataset}>
    <FocusScope id={value.id} layout={value.horizontal ? 'row' : 'column'} boundary="parent" style={style}>
      <ItemList data={value.data} collection={value.key} horizontal={value.horizontal} itemExtent={value.itemExtent}
        viewportExtent={value.viewportExtent} crossExtent={value.crossExtent} itemStyle={itemStyle} testID={testID} renderItem={value.renderItem}
        pinned={value.horizontalAlignment === 'pinned'} keepWindowAttached={Platform.OS === 'android' && reader === false} />
    </FocusScope>
  </CollectionDatasetContext.Provider>;
}
const styles = StyleSheet.create({
  overlayTarget: {position: 'absolute', top: 0, left: 0},
  commitMarker: {position: 'absolute', width: 1, height: 1},
  horizontalViewport: {height: 100}, verticalViewport: {width: 240},
  horizontalItem: {height: 80}, verticalItem: {width: 220},
});

// Ordinary D-pad moves only update this subscriber. They do not render the outer
// FlatList or replace its cell renderer, data and layout callbacks.
function HeaderAlignment({rows, headerExtent, headerScope, viewport, scrollOffset, preparing}: {
  rows: readonly FocusRailRow[]; headerExtent: number; headerScope?: string;
  viewport: React.RefObject<FlatList<FocusRailRow> | null>; scrollOffset: React.RefObject<number>; preparing: boolean;
}) {
  const focus = useFocusState();
  const alignedKey = useRef<string | null>(null);
  React.useEffect(() => {
    if (focus.kind !== 'managed') { return; }
    const row = rows.find(candidate => candidate.items.some(item => item.occurrenceKey === focus.occurrenceKey));
    if (!row) { alignedKey.current = null; return; }
    if (preparing || alignedKey.current === focus.occurrenceKey) { return; }
    alignedKey.current = focus.occurrenceKey;
    const offset = headerScrollOffset(headerExtent, scrollOffset.current, row.id === headerScope);
    if (offset !== scrollOffset.current) {
      scrollOffset.current = offset;
      viewport.current?.scrollToOffset({offset, animated: false});
    }
  }, [focus, preparing, rows, headerExtent, headerScope, scrollOffset, viewport]);
  return null;
}

/** Two-level row-then-item realization with logical column entry. */
export function FocusVirtualizedRails({id, rails, rowExtent, itemExtent, viewportExtent, viewportRows = 2,
  style, itemStyle, testID, viewportHeight, headerExtent = 0, listHeader, listHeaderExtent = 0,
  listHeaderItems, listHeaderScope, renderDecoration, renderItem, renderRailHeader, active = true, onReady, onEndReached, rowEntry = 'nearest', horizontalAlignment = 'nearest'}: RailsProps<VirtualizedFocusItem, StyleProp<ViewStyle>>) {
  const parent = useContext(ScopeContext);
  const store = useCollection();
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const reader = useScreenReaderEnabled();
  // Keep the bounded render window attached for Android's engine-owned row moves.
  // The native screen reader keeps the platform's usual subtree clipping.
  const keepRowsAttached = Platform.OS === 'android' && reader === false;
  const viewport = useRef<FlatList<FocusRailRow>>(null);
  const scrollOffset = useRef(0);
  const model = useMemo(() => {
    alignment(horizontalAlignment);
    if (rowEntry !== 'nearest' && rowEntry !== 'first' && rowEntry !== 'remembered') { throw new Error('rowEntry must be nearest, first or remembered'); }
    if (rowEntry !== 'nearest' && !supported) {
      throw new Error('Explicit rowEntry requires an Android TV or tvOS adapter');
    }
    extent(itemExtent); extent(rowExtent); extent(viewportExtent);
    if (viewportHeight !== undefined) { extent(viewportHeight); }
    if (!Number.isFinite(headerExtent) || headerExtent < 0 || headerExtent >= rowExtent) { throw new Error('Rail header must fit inside its fixed row extent'); }
    const hasHeader = listHeader !== undefined && listHeader !== null;
    if (hasHeader) {
      extent(listHeaderExtent);
      if (!listHeaderScope || !listHeaderItems?.length || rails.some(rail => rail.id === listHeaderScope)) {
        throw new Error('A leading row requires a unique scope and declared focus items');
      }
    } else if (listHeaderExtent || listHeaderItems || listHeaderScope) {
      throw new Error('Leading row metadata requires rendered content');
    }
    if (!id || !Number.isInteger(viewportRows) || viewportRows < 1 || viewportRows > 10) { throw new Error('Rails require a stable id and 1–10 viewport rows'); }
    const path = [...parent.path, id];
    const key = nativeScopeKey(path);
    const declaredRails = hasHeader && listHeaderScope && listHeaderItems
      ? [{id: listHeaderScope, items: listHeaderItems}, ...rails] : rails;
    const rows = declaredRails.map(rail => {
      if (!rail.id) { throw new Error('Rails require stable nonempty ids'); }
      if (rail.itemExtent !== undefined) { extent(rail.itemExtent); }
      return {...rail, key: nativeScopeKey([...path, rail.id])};
    });
    const policy = {nearest: 0, first: 1, remembered: 2} as const;
    const nodes = [{...list(key, parent.key, 0, false, rowExtent), leadingExtent: listHeaderExtent, rowEntry: policy[rowEntry]}, ...rows.flatMap((row, index) =>
      [{...list(row.key, key, index, true, row.itemExtent ?? itemExtent), horizontalAlignment}, ...items(row.items, row.key)])];
    return {id, key, rows, nodes, itemExtent, rowExtent, viewportExtent, viewportRows, viewportHeight, headerExtent,
      listHeader, listHeaderExtent, listHeaderScope, renderDecoration, renderItem, renderRailHeader, horizontalAlignment};
  }, [id, rails, rowExtent, itemExtent, viewportExtent, viewportRows, viewportHeight, headerExtent, listHeader,
    listHeaderExtent, listHeaderItems, listHeaderScope, renderDecoration, renderItem, renderRailHeader, parent.path, parent.key, rowEntry, horizontalAlignment]);
  const published = usePublished(model, active);
  React.useEffect(() => {
    // A layout effect may publish a replacement after this render's snapshot.
    // Only the live accepted revision can authorize entry into the new content.
    const current = store.snapshot();
    if (active && published && (!supported ||
        (published.dataset === current.dataset && published.dataset === current.accepted))) { onReady?.(); }
  }, [store, active, published, snapshot.dataset, snapshot.accepted, onReady]);
  const collection = published?.model.key ?? model.key;
  const Cell = useMemo(() => renderer<FocusRailRow>(store, collection, row => row.key), [store, collection]);
  if (!published) { return <View style={style} testID={testID} />; }
  const value = published.model;
  const preparation = snapshot.preparation;
  return <CollectionDatasetContext.Provider value={published.dataset}>
    <FocusScope id={value.id} active={active} layout="column" boundary="parent" style={style}>
      <FlatList ref={viewport} onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
        onEndReached={active ? onEndReached : undefined} onEndReachedThreshold={0.5} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} data={value.rows} keyExtractor={row => row.id} testID={testID}
        style={{height: value.viewportHeight ?? value.rowExtent * value.viewportRows, width: value.viewportExtent}}
        CellRendererComponent={Cell} extraData={snapshot.preparation} additionalRenderRegions={store.regions(value.key)}
        removeClippedSubviews={keepRowsAttached ? false : undefined}
        initialNumToRender={1} maxToRenderPerBatch={1} windowSize={3}
        getItemLayout={(_, index) => ({length: index === 0 && value.listHeaderExtent ? value.listHeaderExtent : value.rowExtent,
          offset: value.listHeaderExtent && index > 0 ? value.listHeaderExtent + value.rowExtent * (index - 1) : value.rowExtent * index, index})}
        renderItem={({item}) => item.id === value.listHeaderScope ?
          <View style={{height: value.listHeaderExtent}}>
            {value.listHeader}
            {preparation && preparation.path[preparation.step]?.collection === item.key &&
              item.items.some(target => nativeTargetKey(target.occurrenceKey) === preparation.key) ?
              <View key={`${preparation.request}/${preparation.effect}/${preparation.step}`} collapsable={false}
                accessible={false} pointerEvents="none" style={styles.commitMarker}
                onLayout={() => store.committed(preparation, preparation.key)} /> : null}
          </View> :
          <FocusScope id={item.id} layout="row" boundary="parent" style={{height: value.rowExtent}}>
          {value.headerExtent > 0 && <View accessible={false} pointerEvents="none" style={{height: value.headerExtent}}>{value.renderRailHeader?.(item)}</View>}
          <ItemList data={item.items} collection={item.key} horizontal nestedRow itemExtent={item.itemExtent ?? value.itemExtent}
            viewportExtent={value.viewportExtent} crossExtent={value.rowExtent - value.headerExtent}
            pinned={value.horizontalAlignment === 'pinned'} keepWindowAttached={keepRowsAttached} overlayTarget={item.overlayTarget} itemStyle={item.itemStyle ?? itemStyle} renderDecoration={value.renderDecoration} renderItem={value.renderItem} />
        </FocusScope>} />
      {active && value.listHeaderExtent > 0 &&
        <HeaderAlignment rows={value.rows} headerExtent={value.listHeaderExtent} headerScope={value.listHeaderScope}
          preparing={!!preparation} viewport={viewport} scrollOffset={scrollOffset} />}
    </FocusScope>
  </CollectionDatasetContext.Provider>;
}
