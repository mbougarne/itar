import type React from "react";
import type { Activation } from "./types";

export type ProviderProps<Style> = {
  children: React.ReactNode;
  active?: boolean;
  style?: Style;
  testID?: string;
};

export type ScopeProps<Style> = {
  id: string;
  active?: boolean;
  layout?: "spatial" | "row" | "column";
  boundary?: "stop" | "wrap" | "parent";
  trap?: boolean;
  /** Gate automatic native entry while preparing content.
   * Android permits an exact preferredKey and explicit accessibility focus actions.
   * Explicit focusByKey still works; existing input focus is preserved.
   * Commit false before removing the source, then reopen after the request settles.
   */
  entryReady?: boolean;
  preferredKey?: string;
  children: React.ReactNode;
  /** Restore valid native history (then preference) on directional scope entry. */
  restoreOnEntry?: boolean;
  /** Android route/pane semantics, exposed only while active and ready. */
  accessibilityPaneTitle?: string;
  style?: Style;
  testID?: string;
};

export type TargetProps<Style, Color> = {
  occurrenceKey: string;
  /** Presentation-only content. The owned host remains the sole semantic target. */
  children?: React.ReactNode;
  contentId?: string;
  displayLabel?: string;
  labelPlacement?: "center" | "bottom" | "bottom-center";
  labelSize?: number;
  outlineInsetBottom?: number;
  accessibilityLabel: string;
  /** Android/web only. A switch requires a Boolean checked state; Apple keeps its current semantics. */
  accessibilityRole?: "button" | "switch";
  accessibilityState?: Readonly<{ checked?: boolean }>;
  enabled?: boolean;
  order?: number;
  style?: Style;
  focusStyle?: Readonly<{ accentColor: Color; backgroundColor?: Color }>;
  baseAccentColor?: Color;
  onPress?(activation: Activation): void;
  onAdjust?(delta: -1 | 1): void;
  testID?: string;
};

export type Rail<Item, Style> = Readonly<{
  id: string;
  items: readonly Item[];
  overlayTarget?: boolean;
  itemExtent?: number;
  itemStyle?: Style;
}>;
export type ItemRenderer<Item> = (item: Item, index: number) => React.ReactNode;
type CollectionProps<Item, Style> = {
  id: string;
  itemExtent: number;
  viewportExtent: number;
  style?: Style;
  itemStyle?: Style;
  renderItem?: ItemRenderer<Item>;
  testID?: string;
  horizontalAlignment?: "nearest" | "leading" | "pinned";
};
export type ListProps<Item, Style> = CollectionProps<Item, Style> & {
  data: readonly Item[];
  horizontal?: boolean;
  crossExtent?: number;
};
export type RailsProps<Item, Style> = CollectionProps<Item, Style> & {
  /** Logical Up/Down entry into an adjacent rail on the native TV adapters. */
  rowEntry?: "nearest" | "first" | "remembered";
  active?: boolean;
  onReady?: () => void;
  onEndReached?: () => void;
  rails: readonly Rail<Item, Style>[];
  rowExtent: number;
  viewportRows?: number;
  viewportHeight?: number;
  headerExtent?: number;
  /** A real leading collection row. Render its matching scope and focusable items
   * inside a horizontal ScrollView so offscreen return uses the normal reveal path. */
  listHeader?: React.ReactNode;
  listHeaderExtent?: number;
  listHeaderItems?: readonly Item[];
  listHeaderScope?: string;
  renderDecoration?: (item: Item) => React.ReactNode;
  renderRailHeader?: (rail: Rail<Item, Style>) => React.ReactNode;
};
