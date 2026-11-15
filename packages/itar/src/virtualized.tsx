import React, {memo, useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {FlatList, Platform, StyleSheet, View} from 'react-native';
import type {FlatListProps, StyleProp, ViewStyle} from 'react-native';
import {CollectionContext, CollectionDatasetContext, ScopeContext} from './api/contexts';
import {nativeScopeKey, nativeTargetKey} from './api/types';
import type {CollectionNode, CollectionStore} from './api/collections';
import {Focusable, FocusScope, useFocusState} from './react';
import {headerScrollOffset} from './api/viewport';
import type {FocusableProps} from './react';

export type VirtualizedFocusItem = Omit<FocusableProps, 'order' | 'style'>;
export type VirtualizedFocusRail = Readonly<{id: string; items: readonly VirtualizedFocusItem[];
  overlayTarget?: boolean; itemExtent?: number; itemStyle?: StyleProp<ViewStyle>}>;
type FocusRailRow = VirtualizedFocusRail & {key: string};
type Common = {id: string; itemExtent: number; viewportExtent: number; style?: StyleProp<ViewStyle>;
  itemStyle?: StyleProp<ViewStyle>; testID?: string};
const supported = Platform.isTV && (Platform.OS === 'ios' || Platform.OS === 'android');
function extent(value: number) {
  if (!Number.isFinite(value) || value <= 0 || value > 1000000) { throw new Error('List extents must be positive and at most 1000000'); }
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
const ItemList = memo(function ItemListView({data, collection, horizontal, itemExtent, viewportExtent, itemStyle, testID, crossExtent = 100, renderDecoration, overlayTarget = false}: {
  data: readonly VirtualizedFocusItem[]; collection: string; horizontal: boolean; itemExtent: number;
  viewportExtent: number; itemStyle?: StyleProp<ViewStyle>; testID?: string; crossExtent?: number;
  overlayTarget?: boolean; renderDecoration?: (item: VirtualizedFocusItem) => React.ReactNode;
}) {
  const store = useCollection();
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const Cell = useMemo(() => renderer<VirtualizedFocusItem>(store, collection, item => nativeTargetKey(item.occurrenceKey)), [store, collection]);
  return <FlatList data={data} horizontal={horizontal} testID={testID}
    style={horizontal ? [styles.horizontalViewport, {width: viewportExtent, height: crossExtent}] : [styles.verticalViewport, {height: viewportExtent}]}
    showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}
    keyExtractor={item => item.occurrenceKey} CellRendererComponent={Cell} extraData={snapshot.preparation}
    additionalRenderRegions={store.regions(collection)} initialNumToRender={2} maxToRenderPerBatch={2} windowSize={3}
    getItemLayout={(_, index) => ({length: itemExtent, offset: itemExtent * index, index})}
    renderItem={({item, index}) => {
      const target = <Focusable {...item} order={index}
        style={[horizontal ? styles.horizontalItem : styles.verticalItem,
          horizontal ? {width: itemExtent} : {height: itemExtent}, itemStyle, overlayTarget && styles.overlayTarget]} />;
      return renderDecoration ? <View style={horizontal ? {width: itemExtent, height: crossExtent} : {height: itemExtent}}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none">{renderDecoration(item)}</View>
        {target}
      </View> : target;
    }} />;
});

/** Fixed-extent owned buttons using the pinned react-native-tvos FlatList. */
export function FocusVirtualizedList({id, data, horizontal = true, itemExtent, viewportExtent, style, itemStyle, testID}: Common & {
  data: readonly VirtualizedFocusItem[]; horizontal?: boolean;
}) {
  const parent = useContext(ScopeContext);
  const model = useMemo(() => {
    extent(itemExtent); extent(viewportExtent);
    if (!id) { throw new Error('A virtualized list requires a stable id'); }
    const key = nativeScopeKey([...parent.path, id]);
    return {id, key, data, horizontal, itemExtent, viewportExtent,
      nodes: [list(key, parent.key, 0, horizontal, itemExtent), ...items(data, key)]};
  }, [id, data, horizontal, itemExtent, viewportExtent, parent.path, parent.key]);
  const published = usePublished(model);
  if (!published) { return <View style={style} testID={testID} />; }
  const value = published.model;
  return <CollectionDatasetContext.Provider value={published.dataset}>
    <FocusScope id={value.id} layout={value.horizontal ? 'row' : 'column'} boundary="parent" style={style}>
      <ItemList data={value.data} collection={value.key} horizontal={value.horizontal} itemExtent={value.itemExtent}
        viewportExtent={value.viewportExtent} itemStyle={itemStyle} testID={testID} />
    </FocusScope>
  </CollectionDatasetContext.Provider>;
}
const styles = StyleSheet.create({
  overlayTarget: {position: 'absolute', top: 0, left: 0},
  commitMarker: {position: 'absolute', width: 1, height: 1},
  horizontalViewport: {height: 100}, verticalViewport: {width: 240},
  horizontalItem: {height: 80}, verticalItem: {width: 220},
});

/** Two-level row-then-item realization with logical column entry. */
export function FocusVirtualizedRails({id, rails, rowExtent, itemExtent, viewportExtent, viewportRows = 2,
  style, itemStyle, testID, viewportHeight, headerExtent = 0, listHeader, listHeaderExtent = 0,
  listHeaderItems, listHeaderScope, renderDecoration, renderRailHeader, active = true, onReady, onEndReached, rowEntry = 'nearest'}: Common & {
    /** Logical Up/Down entry into an adjacent rail on the native TV adapters. */
    rowEntry?: 'nearest' | 'first';
    active?: boolean; onReady?: () => void; onEndReached?: () => void; rails: readonly VirtualizedFocusRail[]; rowExtent: number; viewportRows?: number; viewportHeight?: number; headerExtent?: number;
    /** A real leading collection row. Render its matching scope and focusable items
     * inside a horizontal ScrollView so offscreen return uses the normal reveal path. */
    listHeader?: React.ReactNode; listHeaderExtent?: number;
    listHeaderItems?: readonly VirtualizedFocusItem[]; listHeaderScope?: string;
    renderDecoration?: (item: VirtualizedFocusItem) => React.ReactNode;
    renderRailHeader?: (rail: VirtualizedFocusRail) => React.ReactNode;
  }) {
  const parent = useContext(ScopeContext);
  const store = useCollection();
  const snapshot = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const focus = useFocusState();
  const viewport = useRef<FlatList<FocusRailRow>>(null);
  const scrollOffset = useRef(0);
  const alignedKey = useRef<string | null>(null);
  const model = useMemo(() => {
    if (rowEntry !== 'nearest' && rowEntry !== 'first') { throw new Error('rowEntry must be nearest or first'); }
    if (rowEntry === 'first' && !supported) {
      throw new Error('rowEntry first requires an Android TV or tvOS adapter');
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
    const nodes = [{...list(key, parent.key, 0, false, rowExtent), leadingExtent: listHeaderExtent, rowEntry: rowEntry === 'first' ? 1 as const : 0 as const}, ...rows.flatMap((row, index) =>
      [list(row.key, key, index, true, row.itemExtent ?? itemExtent), ...items(row.items, row.key)])];
    return {id, key, rows, nodes, itemExtent, rowExtent, viewportExtent, viewportRows, viewportHeight, headerExtent,
      listHeader, listHeaderExtent, listHeaderScope, renderDecoration, renderRailHeader};
  }, [id, rails, rowExtent, itemExtent, viewportExtent, viewportRows, viewportHeight, headerExtent, listHeader,
    listHeaderExtent, listHeaderItems, listHeaderScope, renderDecoration, renderRailHeader, parent.path, parent.key, rowEntry]);
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
  React.useEffect(() => {
    const value = published?.model;
    if (!active || !value || !value.listHeaderExtent || focus.kind !== 'managed') { return; }
    const row = value.rows.find(candidate => candidate.items.some(item => item.occurrenceKey === focus.occurrenceKey));
    if (!row) { alignedKey.current = null; return; }
    if (snapshot.preparation || alignedKey.current === focus.occurrenceKey) { return; }
    alignedKey.current = focus.occurrenceKey;
    // Apply the application's Hero presentation only after actual host focus,
    // without racing the collection's pending reveal or resetting deeper rows.
    const offset = headerScrollOffset(value.listHeaderExtent, scrollOffset.current, row.id === value.listHeaderScope);
    if (offset !== scrollOffset.current) {
      scrollOffset.current = offset;
      viewport.current?.scrollToOffset({offset, animated: false});
    }
  }, [active, published, focus, snapshot.preparation]);
  if (!published) { return <View style={style} testID={testID} />; }
  const value = published.model;
  const preparation = snapshot.preparation;
  return <CollectionDatasetContext.Provider value={published.dataset}>
    <FocusScope id={value.id} active={active} layout="column" boundary="parent" style={style}>
      <FlatList ref={viewport} onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
        onEndReached={active ? onEndReached : undefined} onEndReachedThreshold={0.5} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} data={value.rows} keyExtractor={row => row.id} testID={testID}
        style={{height: value.viewportHeight ?? value.rowExtent * value.viewportRows, width: value.viewportExtent}}
        CellRendererComponent={Cell} extraData={snapshot.preparation} additionalRenderRegions={store.regions(value.key)}
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
          <ItemList data={item.items} collection={item.key} horizontal itemExtent={item.itemExtent ?? value.itemExtent}
            viewportExtent={value.viewportExtent} crossExtent={value.rowExtent - value.headerExtent}
            overlayTarget={item.overlayTarget} itemStyle={item.itemStyle ?? itemStyle} renderDecoration={value.renderDecoration} />
        </FocusScope>} />
    </FocusScope>
  </CollectionDatasetContext.Provider>;
}
