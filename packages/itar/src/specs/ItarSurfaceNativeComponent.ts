import type * as React from 'react';
import type {ViewProps, HostComponent} from 'react-native';
import type {DirectEventHandler, WithDefault} from 'react-native/Libraries/Types/CodegenTypes';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import codegenNativeCommands from 'react-native/Libraries/Utilities/codegenNativeCommands';

export interface NativeProps extends ViewProps {
  active?: WithDefault<boolean, true>;
  onFocusRecord?: DirectEventHandler<Readonly<{
    lifetime: string;
    request: string;
    occurrenceKey: string;
    mount: string;
    kind: string;
  }>>;
}
interface NativeCommands {
  focus(viewRef: React.ElementRef<HostComponent<NativeProps>>, occurrenceKey: string): void;
  cancel(viewRef: React.ElementRef<HostComponent<NativeProps>>, request: string): void;
}
export const Commands = codegenNativeCommands<NativeCommands>({supportedCommands: ['focus', 'cancel']});
export default codegenNativeComponent<NativeProps>('ItarSurface') as HostComponent<NativeProps>;
