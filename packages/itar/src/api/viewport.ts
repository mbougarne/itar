// App viewport alignment follows confirmed input focus. It does not select focus
// or replace native realization: callers wait until pending preparation finishes.
export function headerScrollOffset(headerExtent: number, currentOffset: number, headerFocused: boolean): number {
  return headerFocused ? 0 : Math.max(currentOffset, headerExtent);
}

// Coordinates are measured from the physical left edge; DOM RTL scrollLeft is
// converted by its adapter. This function never chooses a focus destination.
export function horizontalScrollOffset(start: number, end: number, current: number,
  viewport: number, content: number, alignment: 'nearest' | 'leading', rtl = false): number {
  let desired = current;
  if (alignment === 'leading' || end - start > viewport) {
    desired = rtl ? end - viewport : start;
  } else if (start < current) {
    desired = start;
  } else if (end > current + viewport) {
    desired = end - viewport;
  }
  return Math.min(Math.max(0, desired), Math.max(0, content - viewport));
}
