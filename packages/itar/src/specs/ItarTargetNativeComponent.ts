import type {ColorValue, ViewProps, HostComponent} from 'react-native';
import type {DirectEventHandler, Int32, WithDefault} from 'react-native/Libraries/Types/CodegenTypes';
import {codegenNativeComponent} from 'react-native';

export interface NativeProps extends ViewProps {
  occurrenceKey: string;
  label: string;
  enabled?: WithDefault<boolean, true>;
  order?: Int32;
  baseColor?: ColorValue;
  focusColor?: ColorValue;
  onActivate?: DirectEventHandler<Readonly<{
    lifetime: string;
    occurrenceKey: string;
    mount: string;
    sequence: string;
    source: string;
  }>>;
}
export default codegenNativeComponent<NativeProps>('ItarTarget', {excludedPlatforms: ['iOS']}) as HostComponent<NativeProps>;
