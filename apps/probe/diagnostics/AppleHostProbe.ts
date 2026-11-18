import {
  Platform,
  requireNativeComponent,
  type NativeSyntheticEvent,
  type ViewProps,
} from 'react-native';

export const AppleHostProbe =
  Platform.OS === 'ios'
    ? requireNativeComponent<
        ViewProps & {
          onNativeActivation: (
            event: NativeSyntheticEvent<{
              target: string;
              targetAlias?: string;
            }>,
          ) => void;
        }
      >('ItarAppleProbe')
    : null;
