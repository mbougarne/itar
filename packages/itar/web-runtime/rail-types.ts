import type React from 'react';
import type {
  FocusVirtualizedRails as NativeRails,
  VirtualizedFocusItem,
  VirtualizedFocusRail,
  VirtualizedFocusItemRenderer,
} from '../src/virtualized';

export type RowProps = {
  rail: VirtualizedFocusRail;
  height: number;
  width: number;
  extent: number;
  headerHeight: number;
  renderHeader?: (rail: VirtualizedFocusRail) => React.ReactNode;
  renderItem?: VirtualizedFocusItemRenderer;
  decoration?: (item: VirtualizedFocusItem) => React.ReactNode;
  forced?: string;
  alignment: 'nearest' | 'leading' | 'pinned';
  active: boolean;
};

export type RailsProps = React.ComponentProps<typeof NativeRails> & {
  listHeader?: React.ReactNode;
  listHeaderExtent?: number;
  listHeaderItems?: readonly VirtualizedFocusItem[];
  listHeaderScope?: string;
};
