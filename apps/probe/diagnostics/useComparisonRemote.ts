import { useTVEventHandler } from 'react-native';
import { SpatialNavigation } from 'react-tv-space-navigation';

type RemoteCallback = Parameters<
  Parameters<
    typeof SpatialNavigation.configureRemoteControl
  >[0]['remoteControlSubscriber']
>[0];

const listeners = new Set<RemoteCallback>();

SpatialNavigation.configureRemoteControl({
  remoteControlSubscriber: callback => {
    listeners.add(callback);

    return callback;
  },
  remoteControlUnsubscriber: (subscriber: unknown) => {
    for (const callback of listeners) {
      if (callback === subscriber) {
        listeners.delete(callback);
      }
    }
  },
});

export function useComparisonRemote() {
  useTVEventHandler(event => {
    if (event.eventKeyAction === 1) {
      return;
    }

    const direction = event.eventType;

    if (
      direction === 'left' ||
      direction === 'right' ||
      direction === 'up' ||
      direction === 'down'
    ) {
      for (const listener of listeners) {
        listener(direction);
      }
    }
  });
}
