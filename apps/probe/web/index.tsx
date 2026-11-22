import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../ott/App';
import { BrowserNavigation } from '../ott/src/browser-navigation';
import {
  initializeFocusEngine,
  setDirectionalNavigationEnabled,
} from './focus';
import { hasSystemBack } from './platform';
import './styles.css';

declare const __OCCO__: boolean;

const Development = __OCCO__ ? require('./OccoWeb').OccoWeb : React.Fragment;

const root = document.getElementById('root');

if (!root) {
  throw new Error('Itar root element is missing');
}

function BrowserApp() {
  const [enabled, setEnabled] = useState(true);

  function toggle() {
    setDirectionalNavigationEnabled(!enabled);
    setEnabled(!enabled);
  }

  return (
    <BrowserNavigation.Provider
      value={{ enabled, toggle, systemBackAtRoot: hasSystemBack() }}
    >
      <Development>
        <App />
      </Development>
    </BrowserNavigation.Provider>
  );
}

root.setAttribute('role', 'status');
root.textContent = 'Loading Itar Cinema…';

initializeFocusEngine().then(
  () => {
    root.removeAttribute('role');
    createRoot(root).render(<BrowserApp />);
  },
  () => {
    root.setAttribute('role', 'alert');

    root.textContent =
      'Itar Cinema could not start. Reload the page or try a newer browser.';
  },
);
