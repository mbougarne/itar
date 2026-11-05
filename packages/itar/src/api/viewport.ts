// App viewport alignment follows confirmed input focus. It does not select focus
// or replace native realization: callers wait until pending preparation finishes.
export function headerScrollOffset(headerExtent: number, currentOffset: number, headerFocused: boolean): number {
  return headerFocused ? 0 : Math.max(currentOffset, headerExtent);
}
