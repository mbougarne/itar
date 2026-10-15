import type * as React from 'react';
import type {ViewProps, HostComponent} from 'react-native';
import type {DirectEventHandler, WithDefault} from 'react-native/Libraries/Types/CodegenTypes';
import {codegenNativeComponent} from 'react-native';
import {codegenNativeCommands} from 'react-native';

export interface NativeProps extends ViewProps {
  active?: WithDefault<boolean, true>;
  onFocusRecord?: DirectEventHandler<Readonly<{
    lifetime: string;
    request: string;
    occurrenceKey: string;
    mount: string;
    kind: string;
    channel: string;
  }>>;
  onRequestRecord?: DirectEventHandler<Readonly<{
    lifetime: string;
    request: string;
    status: string;
  }>>;
}
interface NativeCommands {
  focus(viewRef: React.ElementRef<HostComponent<NativeProps>>, occurrenceKey: string): void;
  cancel(viewRef: React.ElementRef<HostComponent<NativeProps>>, lifetime: string, request: string): void;
  showDialog(viewRef: React.ElementRef<HostComponent<NativeProps>>): void;
  dismissDialog(viewRef: React.ElementRef<HostComponent<NativeProps>>): void;
}
export const Commands = codegenNativeCommands<NativeCommands>({supportedCommands: ['focus', 'cancel', 'showDialog', 'dismissDialog']});
export default codegenNativeComponent<NativeProps>('ItarSurface', {excludedPlatforms: ['iOS']}) as HostComponent<NativeProps>;
