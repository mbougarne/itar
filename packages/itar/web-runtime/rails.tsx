import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  VirtualizedFocusItem,
  VirtualizedFocusRail,
} from '../src/virtualized';
import {
  nativeScopeKey,
  nativeTargetKey,
} from '../src/api/types';
import {
  headerScrollOffset,
  horizontalScrollOffset,
} from '../src/api/viewport';
import { useWebStore, WebScopeContext } from './focus-context';
import { useFocusState } from './focus-hooks';
import { createNode, type Registration } from './focus-store';
import { FocusScope } from './FocusScope';
import { Rail } from './Rail';
import { htmlStyles } from './rail-styles';
import type { RailsProps } from './rail-types';
import { visibleIndices } from './window';

const noHeaderItems: readonly VirtualizedFocusItem[] = [];

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
  renderItem,
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
      horizontalAlignment !== 'leading' &&
      horizontalAlignment !== 'pinned'
    ) {
      throw new Error('horizontalAlignment must be nearest, leading or pinned');
    }

    if (
      rowEntry !== 'nearest' &&
      rowEntry !== 'first' &&
      rowEntry !== 'remembered'
    ) {
      throw new Error('rowEntry must be nearest, first or remembered');
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
        rowEntry: rowEntry === 'remembered' ? 2 : rowEntry === 'first' ? 1 : 0,
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
        horizontalAlignment:
          horizontalAlignment === 'pinned'
            ? 2
            : horizontalAlignment === 'leading'
            ? 1
            : 0,
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
      horizontalAlignment === 'nearest' ||
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
                  renderItem={renderItem}
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
