// Copied next to the installed tarball so imports exercise the consumer's exports.
import React, {StrictMode, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Focusable, FocusProvider, FocusScope, initializeFocusEngine, useFocusCommands,
} from '@bougarnem/itar/web';
import '@bougarnem/itar/web.css';

const rowStyle = {flexDirection: 'row'} as const;
const cardStyle = {width: 150, height: 80};

function Row() {
  const {focusByKey} = useFocusCommands();
  useEffect(() => {
    if (location.hash !== '#smoke') return;
    const timer = setTimeout(async () => {
      const first = await focusByKey('First').result;
      if (first.status !== 'applied') return;
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
      const second = document.activeElement;
      if (second instanceof HTMLElement && second.getAttribute('aria-label') === 'Second') second.click();
    }, 0);
    return () => clearTimeout(timer);
  }, [focusByKey]);

  return <FocusScope id="row" layout="row" style={rowStyle}>
    {['First', 'Second'].map(key => <Focusable key={key} occurrenceKey={key}
      accessibilityLabel={key} style={cardStyle}
      onPress={async () => {
        const outcome = await focusByKey('First').result;
        if (document.activeElement?.getAttribute('aria-label') === 'First') {
          document.title = key + ' ' + outcome.status;
        }
      }}/>)}
  </FocusScope>;
}

initializeFocusEngine().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode><FocusProvider><Row /></FocusProvider></StrictMode>,
  );
});
