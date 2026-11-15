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
import { createNode, directionalNavigationEnabled } from './focus-store';
import type { Registration } from './focus-store';
import {
  headerScrollOffset,
  horizontalScrollOffset,
} from '../../../packages/itar/src/api/viewport';

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
  alignment: 'nearest' | 'leading';
  active: boolean;
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
  alignment,
  active,
}: RowProps) {
  const [start, setStart] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const focus = useFocusState();
  const store = useWebStore();
  const previousAlignment = useRef(alignment);

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
    const changed = previousAlignment.current !== alignment;

    previousAlignment.current = alignment;

    const view = scroll.current;

    if (!view) {
      return;
    }

    const reversed = getComputedStyle(view).direction === 'rtl';

    const index = requested >= 0 ? requested : focused;

    const content = rail.items.length * extent;
    const maximum = Math.max(0, content - width);
    const current = reversed ? maximum + view.scrollLeft : view.scrollLeft;

    setStart(Math.floor(current / extent));

    if (
      !active ||
      !directionalNavigationEnabled ||
      index < 0 ||
      (requested >= 0 ? changed : !store.canAlign()) ||
      (requested < 0 && alignment !== 'leading')
    ) {
      return;
    }

    const itemStart = index * extent;

    const offset = horizontalScrollOffset(
      itemStart,
      itemStart + extent,
      current,
      width,
      content,
      alignment,
      reversed,
    );

    view.scrollLeft = reversed ? offset - maximum : offset;
    setStart(Math.floor(offset / extent));
  }, [
    requested,
    focused,
    extent,
    width,
    rail.items.length,
    alignment,
    active,
    store,
  ]);

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
        onScroll={event => {
          const view = event.currentTarget;

          const offset =
            getComputedStyle(view).direction === 'rtl'
              ? Math.max(0, view.scrollWidth - view.clientWidth) +
                view.scrollLeft
              : view.scrollLeft;

          setStart(Math.floor(offset / extent));
        }}
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
  rowEntry = 'nearest',
  horizontalAlignment = 'nearest',
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
    if (
      horizontalAlignment !== 'nearest' &&
      horizontalAlignment !== 'leading'
    ) {
      throw new Error('horizontalAlignment must be nearest or leading');
    }

    if (rowEntry !== 'nearest' && rowEntry !== 'first') {
      throw new Error('rowEntry must be nearest or first');
    }

    const path = [...parent.path, id];
    const root = nativeScopeKey(path);

    const rows: VirtualizedFocusRail[] = hasHeader
      ? [{ id: listHeaderScope, items: listHeaderItems }, ...rails]
      : [...rails];

    const positions = new Map<string, number>();

    const nodes: Registration[] = [
      {
        ...createNode(root, parent.key, true),
        layout: 2,
        collection: true,
        extent: rowExtent,
        rowEntry: rowEntry === 'first' ? 1 : 0,
        active: parent.active && active,
      },
    ];

    rows.forEach((rail, order) => {
      const key = nativeScopeKey([...path, rail.id]);

      nodes.push({
        ...createNode(key, root, true),
        layout: 1,
        collection: true,
        extent: rail.itemExtent ?? itemExtent,
        horizontalAlignment: horizontalAlignment === 'leading' ? 1 : 0,
        order,
        active: parent.active && active,
      });

      rail.items.forEach((item, index) => {
        const target = nativeTargetKey(item.occurrenceKey);

        positions.set(target, order);

        nodes.push({
          ...createNode(target, key),
          collection: true,
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
    rowEntry,
    horizontalAlignment,
    rowExtent,
    itemExtent,
  ]);

  const offset = (index: number) =>
    hasHeader && index > 0
      ? listHeaderExtent + (index - 1) * rowExtent
      : index * rowExtent;

  useLayoutEffect(() => {
    store.collection(token, {
      nodes: model.nodes,
      release: key => setForced(current => (current === key ? '' : current)),
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

  useLayoutEffect(() => {
    if (
      !active ||
      !hasHeader ||
      focusedRow !== 0 ||
      horizontalAlignment !== 'leading' ||
      !store.canAlign()
    ) {
      return;
    }

    const target = document.activeElement;

    if (!(target instanceof HTMLElement) || !outer.current?.contains(target)) {
      return;
    }

    for (
      let port = target.parentElement;
      port && port !== outer.current;
      port = port.parentElement
    ) {
      if (
        port.scrollWidth <= port.clientWidth ||
        !['auto', 'scroll'].includes(getComputedStyle(port).overflowX)
      ) {
        continue;
      }

      const rtl = getComputedStyle(port).direction === 'rtl';
      const maximum = port.scrollWidth - port.clientWidth;
      const current = rtl ? maximum + port.scrollLeft : port.scrollLeft;

      const rect = target.getBoundingClientRect(),
        viewport = port.getBoundingClientRect();

      const headerOffset = horizontalScrollOffset(
        current + rect.left - viewport.left,
        current + rect.right - viewport.left,
        current,
        port.clientWidth,
        port.scrollWidth,
        'leading',
        rtl,
      );

      port.scrollLeft = rtl ? headerOffset - maximum : headerOffset;

      break;
    }
  }, [
    active,
    hasHeader,
    focusedRow,
    focus.occurrenceKey,
    horizontalAlignment,
    forced,
    store,
  ]);

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
                  alignment={horizontalAlignment}
                  active={parent.active && active}
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
  horizontalAlignment = 'nearest',
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
      horizontalAlignment={horizontalAlignment}
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
