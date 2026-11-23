import type { CSSProperties, ReactElement } from "react";
import type {
  ItemRenderer,
  ListProps,
  ProviderProps,
  Rail,
  RailsProps,
  ScopeProps,
  TargetProps,
} from "../lib/api/component-props";
import type { FocusChannel, FocusRequest, FocusState } from "../lib/api/types";

export { occurrenceKey } from "../lib/api/types";
export type {
  Activation,
  FocusChannel,
  FocusKind,
  FocusOutcome,
  FocusRequest,
  FocusState,
} from "../lib/api/types";

type Style = CSSProperties | false | null | readonly Style[];
export type FocusableProps = TargetProps<Style, string>;
export type VirtualizedFocusItem = Omit<FocusableProps, "order" | "style">;
export type VirtualizedFocusRail = Rail<VirtualizedFocusItem, Style>;
export type VirtualizedFocusItemRenderer = ItemRenderer<VirtualizedFocusItem>;

/** Await this before mounting the first provider. The bundle includes the Wasm bytes. */
export function initializeFocusEngine(): Promise<void>;
export function setDirectionalNavigationEnabled(enabled: boolean): void;
export function FocusProvider(props: ProviderProps<Style>): ReactElement;
export function Focusable(props: FocusableProps): ReactElement;
export function FocusScope(
  props: ScopeProps<Style> & { order?: number }
): ReactElement;
export function FocusVirtualizedList(
  props: ListProps<VirtualizedFocusItem, Style>
): ReactElement;
export function FocusVirtualizedRails(
  props: RailsProps<VirtualizedFocusItem, Style>
): ReactElement;
export function useFocusCommands(): {
  focusByKey(key: string): FocusRequest;
  restoreFocusByKey(key: string): FocusRequest;
  restoreScope(path?: readonly string[]): FocusRequest;
  showDialog(): never;
  dismissDialog(): never;
};
export function useFocusReady(): boolean;
export function useFocusState(channel?: FocusChannel): FocusState;
export function useIsFocused(key: string, channel?: FocusChannel): boolean;
export function useScreenReaderEnabled(): boolean | null;
