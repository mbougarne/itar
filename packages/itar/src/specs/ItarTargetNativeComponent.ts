import type {ColorValue, ViewProps, HostComponent} from 'react-native';
import type {Int32, WithDefault} from 'react-native/Libraries/Types/CodegenTypes';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';

export interface NativeProps extends ViewProps {
  occurrenceKey: string;
  label: string;
  enabled?: WithDefault<boolean, true>;
  order?: Int32;
  baseColor?: ColorValue;
  focusColor?: ColorValue;
}
export default codegenNativeComponent<NativeProps>('ItarTarget') as HostComponent<NativeProps>;
