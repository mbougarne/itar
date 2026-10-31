import type {ViewProps, HostComponent} from 'react-native';
import type {WithDefault} from 'react-native/Libraries/Types/CodegenTypes';
import {codegenNativeComponent} from 'react-native';

export interface NativeProps extends ViewProps {
  scopeKey: string;
  collectionDataset?: string;
  parentScopeKey?: string;
  active?: WithDefault<boolean, true>;
  layout?: WithDefault<'spatial' | 'row' | 'column', 'spatial'>;
  boundary?: WithDefault<'stop' | 'wrap' | 'parent', 'stop'>;
  trap?: WithDefault<boolean, false>;
  entryReady?: WithDefault<boolean, true>;
  restoreOnEntry?: WithDefault<boolean, false>;
  preferredKey?: string;
}
export default codegenNativeComponent<NativeProps>('ItarScope') as HostComponent<NativeProps>;
