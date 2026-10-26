/// <reference types="node" />
// This must still accept the actual native event when Node globals are present.
import type {CellRendererProps} from '@react-native-tvos/virtualized-lists';
import type {FocusEvent, ViewProps} from 'react-native';
type CellCapture = NonNullable<CellRendererProps<unknown>['onFocusCapture']>;
type ViewCapture = NonNullable<ViewProps['onFocusCapture']>;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
export type NativeCellEvent = Assert<Equal<Parameters<CellCapture>[0], FocusEvent>>;
export type ForwardToNativeView = Assert<CellCapture extends ViewCapture ? true : false>;
export type AcceptNativeCapture = Assert<ViewCapture extends CellCapture ? true : false>;
