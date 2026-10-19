import type * as React from 'react';
import type {ViewProps, HostComponent} from 'react-native';
import type {DirectEventHandler, WithDefault} from 'react-native/Libraries/Types/CodegenTypes';
import {codegenNativeComponent} from 'react-native';
import {codegenNativeCommands} from 'react-native';

export interface NativeProps extends ViewProps {
  providerId?: string;
  active?: WithDefault<boolean, true>;
  onSurfaceRecord?: DirectEventHandler<Readonly<{
    lifetime: string;
    provider: string;
    sequence: string;
    state: string;
  }>>;
  onFocusRecord?: DirectEventHandler<Readonly<{
    lifetime: string;
    request: string;
    occurrenceKey: string;
    mount: string;
    kind: string;
    channel: string;
    provider: string;
    sequence: string;
  }>>;
  onRequestRecord?: DirectEventHandler<Readonly<{
    lifetime: string;
    request: string;
    status: string;
    command: string;
    provider: string;
    sequence: string;
  }>>;
}
interface NativeCommands {
  focus(viewRef: React.ElementRef<HostComponent<NativeProps>>, occurrenceKey: string): void;
  cancel(viewRef: React.ElementRef<HostComponent<NativeProps>>, lifetime: string, request: string): void;
  showDialog(viewRef: React.ElementRef<HostComponent<NativeProps>>): void;
  dismissDialog(viewRef: React.ElementRef<HostComponent<NativeProps>>): void;
  focusRequest(viewRef: React.ElementRef<HostComponent<NativeProps>>, occurrenceKey: string, command: string): void;
  cancelRequest(viewRef: React.ElementRef<HostComponent<NativeProps>>, command: string): void;
  restoreScopeRequest(viewRef: React.ElementRef<HostComponent<NativeProps>>, scopeKey: string, command: string): void;
}
export const Commands = codegenNativeCommands<NativeCommands>({supportedCommands: ['focus', 'cancel', 'showDialog', 'dismissDialog', 'focusRequest', 'cancelRequest', 'restoreScopeRequest']});
export default codegenNativeComponent<NativeProps>('ItarSurface') as HostComponent<NativeProps>;
