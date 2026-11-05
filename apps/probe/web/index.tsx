import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../ott/App';
import {
  initializeFocusEngine,
  setDirectionalNavigationEnabled,
} from './focus';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Itar root element is missing');
}

const navigation = document.querySelector<HTMLInputElement>(
  '#directional-navigation',
);

if (navigation) {
  navigation.addEventListener('change', () =>
    setDirectionalNavigationEnabled(navigation.checked),
  );
}

root.setAttribute('role', 'status');
root.textContent = 'Loading Itar Cinema…';

initializeFocusEngine().then(
  () => {
    root.removeAttribute('role');
    createRoot(root).render(<App />);
  },
  () => {
    root.setAttribute('role', 'alert');

    root.textContent =
      'Itar Cinema could not start. Reload the page or try a newer browser.';
  },
);
