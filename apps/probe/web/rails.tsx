import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import type {
  FocusVirtualizedRails as NativeRails,
  FocusVirtualizedList as NativeList,
  VirtualizedFocusItem,
  VirtualizedFocusRail,
} from '../../../packages/itar/src/virtualized';
import {
  nativeScopeKey,
  nativeTargetKey,
} from '../../../packages/itar/src/api/types';
import {
  Focusable,
  FocusScope,
  useFocusState,
  useWebStore,
  WebScopeContext,
} from './focus';
import { createNode } from './focus-store';
import { headerScrollOffset } from '../../../packages/itar/src/api/viewport';

import { visibleIndices } from './window';

type RowProps = {
  rail: VirtualizedFocusRail;
  height: number;
  width: number;
  extent: number;
  headerHeight: number;
  renderHeader?: (rail: VirtualizedFocusRail) => React.ReactNode;
  decoration?: (item: VirtualizedFocusItem) => React.ReactNode;
  forced?: string;
};

function Rail({
  rail,
  height,
  width,
  extent,
  headerHeight,
  renderHeader,
  decoration,
  forced,
}: RowProps) {
  const [start, setStart] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const focus = useFocusState();

  const focused = rail.items.findIndex(
    item => item.occurrenceKey === focus.occurrenceKey,
  );

  const requested = rail.items.findIndex(
    item => nativeTargetKey(item.occurrenceKey) === forced,
  );

  const indices = visibleIndices(
    rail.items.length,
    start,
    Math.ceil(width / extent),
    requested,
    focused,
  );

  useLayoutEffect(() => {
    if (requested >= 0 && scroll.current) {
      scroll.current.scrollLeft = requested * extent;
      setStart(requested);
    }
  }, [requested, extent]);

  return (
    <FocusScope id={rail.id} layout="row" boundary="parent" style={{ height }}>
      {renderHeader?.(rail)}
      <div
        ref={scroll}
        className="itar-web-scrollport"
        style={{
          height: height - headerHeight,
          ...htmlStyles.horizontal,
          width,
        }}
        onScroll={event =>
          setStart(Math.floor(event.currentTarget.scrollLeft / extent))
        }
      >
        <div
          style={{
            height: height - headerHeight,
            width: rail.items.length * extent,
            ...htmlStyles.relative,
          }}
        >
          {indices.map(index => {
            const item = rail.items[index];

            return (
              <View
                key={item.occurrenceKey}
                style={{
                  ...itemStyles.cell,
                  left: index * extent,
                  width: extent,
                  height: height - headerHeight,
                }}
              >
                {decoration && (
                  <View
                    accessible={false}
                    importantForAccessibility="no-hide-descendants"
                    pointerEvents="none"
                  >
                    {decoration(item)}
                  </View>
                )}
                <Focusable
                  {...item}
                  order={index}
                  style={[
                    { width: extent, height: height - headerHeight },
                    rail.itemStyle,
                    decoration && itemStyles.overlay,
                  ]}
                />
              </View>
            );
          })}
        </div>
      </div>
    </FocusScope>
  );
}

const noHeaderItems: readonly VirtualizedFocusItem[] = [];

type RailsProps = React.ComponentProps<typeof NativeRails> & {
  listHeader?: React.ReactNode;
  listHeaderExtent?: number;
  listHeaderItems?: readonly VirtualizedFocusItem[];
  listHeaderScope?: string;
};

export function FocusVirtualizedRails({
  id,
  rails,
  rowExtent,
  itemExtent,
  viewportExtent,
  viewportRows = 1,
  viewportHeight,
  headerExtent = 0,
  active = true,
  onReady,
  onEndReached,
  renderDecoration,
  renderRailHeader,
  style,
  testID,
  listHeader,
  listHeaderExtent = 0,
  listHeaderItems = noHeaderItems,
  listHeaderScope = 'hero-actions',
}: RailsProps) {
  const store = useWebStore();
  const parent = useContext(WebScopeContext);
  const focus = useFocusState();
  const [start, setStart] = useState(0);
  const [forced, setForced] = useState('');
  const outer = useRef<HTMLDivElement>(null);
  const token = useRef({}).current;
  const hasHeader = !!listHeader && listHeaderExtent > 0;
  const height = viewportHeight ?? viewportRows * rowExtent;

  const model = useMemo(() => {
    const path = [...parent.path, id];
    const root = nativeScopeKey(path);

    const rows: VirtualizedFocusRail[] = hasHeader
      ? [{ id: listHeaderScope, items: listHeaderItems }, ...rails]
      : [...rails];

    const positions = new Map<string, number>();

    const nodes = [
      {
        ...createNode(root, parent.key, true),
        layout: 2,
        active: parent.active && active,
      },
    ];

    rows.forEach((rail, order) => {
      const key = nativeScopeKey([...path, rail.id]);

      nodes.push({
        ...createNode(key, root, true),
        layout: 1,
        order,
        active: parent.active && active,
      });

      rail.items.forEach((item, index) => {
        const target = nativeTargetKey(item.occurrenceKey);

        positions.set(target, order);

        nodes.push({
          ...createNode(target, key),
          order: index,
          enabled: item.enabled !== false,
          active: parent.active && active,
        });
      });
    });

    return { nodes, positions, rows };
  }, [
    parent.path,
    parent.key,
    parent.active,
    id,
    active,
    rails,
    hasHeader,
    listHeaderScope,
    listHeaderItems,
  ]);

  const offset = (index: number) =>
    hasHeader && index > 0
      ? listHeaderExtent + (index - 1) * rowExtent
      : index * rowExtent;

  useLayoutEffect(() => {
    store.collection(token, {
      nodes: model.nodes,
      reveal: key => {
        const index = model.positions.get(key);

        if (index === undefined || !active) {
          return false;
        }

        setForced(key);
        setStart(index);

        if (outer.current) {
          outer.current.scrollTop =
            hasHeader && index > 0
              ? listHeaderExtent + (index - 1) * rowExtent
              : index * rowExtent;
        }

        return true;
      },
    });

    return () => store.removeCollection(token);
  }, [store, token, model, active, hasHeader, listHeaderExtent, rowExtent]);

  useLayoutEffect(() => {
    if (active) {
      onReady?.();
    }
  }, [active, model, onReady]);

  useEffect(() => {
    if (
      forced &&
      focus.occurrenceKey &&
      nativeTargetKey(focus.occurrenceKey) === forced
    ) {
      setForced('');
    }
  }, [forced, focus.occurrenceKey]);

  const focusedRow = focus.occurrenceKey
    ? model.positions.get(nativeTargetKey(focus.occurrenceKey)) ?? -1
    : -1;

  const lastAligned = useRef<string | null>(null);

  useEffect(() => {
    if (
      !active ||
      !hasHeader ||
      focusedRow < 0 ||
      !outer.current ||
      focus.occurrenceKey === lastAligned.current
    ) {
      return;
    }

    lastAligned.current = focus.occurrenceKey;

    outer.current.scrollTop = headerScrollOffset(
      listHeaderExtent,
      outer.current.scrollTop,
      focusedRow === 0,
    );
  }, [active, hasHeader, focusedRow, focus.occurrenceKey, listHeaderExtent]);

  const requestedRow = model.positions.get(forced) ?? -1;

  const visible = visibleIndices(
    model.rows.length,
    start,
    Math.ceil(height / rowExtent),
    requestedRow,
    focusedRow,
  );

  return (
    <FocusScope
      id={id}
      layout="column"
      boundary="parent"
      active={active}
      style={style}
      testID={testID}
    >
      <div
        ref={outer}
        className="itar-web-scrollport"
        style={{
          height,
          width: viewportExtent,
          ...htmlStyles.vertical,
        }}
        onScroll={event => {
          const top = event.currentTarget.scrollTop;

          setStart(
            hasHeader
              ? top < listHeaderExtent
                ? 0
                : 1 + Math.floor((top - listHeaderExtent) / rowExtent)
              : Math.floor(top / rowExtent),
          );

          if (
            top + height >= event.currentTarget.scrollHeight - rowExtent &&
            active
          ) {
            onEndReached?.();
          }
        }}
      >
        <div
          style={{
            ...htmlStyles.relative,
            height:
              rails.length * rowExtent + (hasHeader ? listHeaderExtent : 0),
          }}
        >
          {visible.map(index => (
            <div
              key={model.rows[index].id}
              style={{
                ...htmlStyles.row,
                top: offset(index),
                width: viewportExtent,
              }}
            >
              {hasHeader && index === 0 ? (
                listHeader
              ) : (
                <Rail
                  rail={model.rows[index]}
                  height={rowExtent}
                  width={viewportExtent}
                  extent={model.rows[index].itemExtent ?? itemExtent}
                  headerHeight={headerExtent}
                  renderHeader={renderRailHeader}
                  decoration={renderDecoration}
                  forced={forced}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </FocusScope>
  );
}

export function FocusVirtualizedList({
  id,
  data,
  horizontal = true,
  itemExtent,
  viewportExtent,
  itemStyle,
  style,
  testID,
}: React.ComponentProps<typeof NativeList>) {
  const rails = useMemo(
    () =>
      horizontal
        ? [{ id: 'items', items: data, itemExtent, itemStyle }]
        : data.map(item => ({
            id: item.occurrenceKey,
            items: [item],
            itemExtent: 240,
            itemStyle,
          })),
    [horizontal, data, itemExtent, itemStyle],
  );

  return (
    <FocusVirtualizedRails
      id={id}
      rails={rails}
      itemExtent={horizontal ? itemExtent : 240}
      rowExtent={horizontal ? 100 : itemExtent}
      viewportHeight={horizontal ? 100 : viewportExtent}
      viewportExtent={horizontal ? viewportExtent : 240}
      style={style}
      testID={testID}
    />
  );
}

const itemStyles = StyleSheet.create({
  cell: { position: 'absolute', top: 0 },
  overlay: { position: 'absolute', top: 0, left: 0 },
});

const htmlStyles = {
  horizontal: { overflowX: 'auto', overflowY: 'hidden' },
  vertical: { overflowY: 'auto', overflowX: 'hidden', position: 'relative' },
  relative: { position: 'relative' },
  row: { position: 'absolute', left: 0 },
} satisfies Record<string, React.CSSProperties>;
