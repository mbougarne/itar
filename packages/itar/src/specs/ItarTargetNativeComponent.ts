import type {ColorValue, ViewProps, HostComponent} from 'react-native';
import type {DirectEventHandler, Int32, Float, WithDefault} from 'react-native/Libraries/Types/CodegenTypes';
import {codegenNativeComponent} from 'react-native';

export interface NativeProps extends ViewProps {
  occurrenceKey: string;
  scopeKey?: string;
  registrationId?: string;
  collectionDataset?: string;
  label: string;
  displayLabel?: string;
  labelPlacement?: WithDefault<'center' | 'bottom' | 'bottom-center', 'center'>;
  labelSize?: Float;
  outlineInsetBottom?: Float;
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
    provider: string;
    registration: string;
  }>>;
}
export default codegenNativeComponent<NativeProps>('ItarTarget') as HostComponent<NativeProps>;
