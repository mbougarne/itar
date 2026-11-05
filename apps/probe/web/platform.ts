import type { AlertButton, AlertOptions } from 'react-native';

export * from 'react-native-web';

type BackListener = () => boolean | null | undefined;

const listeners = new Set<BackListener>();

function onBack(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.repeat ||
    (!['Escape', 'BrowserBack', 'GoBack'].includes(event.key) &&
      ![10009, 461].includes(event.keyCode))
  ) {
    return;
  }

  for (const listener of Array.from(listeners).reverse()) {
    if (listener()) {
      event.preventDefault();
      event.stopPropagation();

      return;
    }
  }
}

export const BackHandler = {
  addEventListener(_event: 'hardwareBackPress', listener: BackListener) {
    if (!listeners.size) {
      document.addEventListener('keydown', onBack);
    }

    listeners.add(listener);

    return {
      remove() {
        listeners.delete(listener);

        if (!listeners.size) {
          document.removeEventListener('keydown', onBack);
        }
      },
    };
  },
  exitApp() {
    window.close();
  },
};

// Only the OTT app's one/two-action confirmation contract is exposed here.
export const Alert = {
  alert(
    title: string,
    message?: string,
    buttons: AlertButton[] = [],
    options?: AlertOptions,
  ) {
    const text = [title, message].filter(Boolean).join('\n\n');
    const action = buttons.find(button => button.style !== 'cancel');
    const cancel = buttons.find(button => button.style === 'cancel');

    if (buttons.length > 1) {
      // Browser-owned dialogs keep exit confirmation accessible without another focus surface.
      // eslint-disable-next-line no-alert
      if (window.confirm(text)) {
        action?.onPress?.();
      } else {
        (cancel?.onPress ?? options?.onDismiss)?.();
      }
    } else {
      // eslint-disable-next-line no-alert
      window.alert(text);
      (buttons[0]?.onPress ?? options?.onDismiss)?.();
    }
  },
};
