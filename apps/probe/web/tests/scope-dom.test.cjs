/* eslint-env node, es2022 */
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

const filename = path.join(__dirname, '../focus.tsx');

const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React,
    esModuleInterop: true,
  },
});

const moduleRecord = { exports: {} };

vm.runInNewContext(outputText, {
  module: moduleRecord,
  exports: moduleRecord.exports,
  require(name) {
    if (name === 'react') {
      return React;
    }

    if (name === 'react-native') {
      return require('react-native-web');
    }

    if (name.endsWith('/itar-web.js')) {
      return async () => ({ WebEngine: class {} });
    }

    if (name.endsWith('/itar-web.wasm') || name === './rails') {
      return {};
    }

    if (name.endsWith('/api/contexts')) {
      return require('../../../../packages/itar/lib/api/contexts');
    }

    if (name.endsWith('/api/types')) {
      return require('../../../../packages/itar/lib/api/types');
    }

    if (name === './focus-store') {
      // Only engine registration/effects are doubled; React and RNW render real DOM attributes.
      return {
        WebFocusStore: class {
          mountId() {
            return 1;
          }
        },
        createNode: (key, parent) => ({ key, parent }),
      };
    }

    throw new Error(`Unexpected import ${name}`);
  },
});

const { FocusProvider, FocusScope, Focusable, initializeFocusEngine } =
  moduleRecord.exports;

before(initializeFocusEngine);

function render(active, parentActive = true) {
  return renderToStaticMarkup(
    React.createElement(
      FocusProvider,
      null,
      React.createElement(
        FocusScope,
        { id: 'route', active: parentActive },
        React.createElement(
          FocusScope,
          { id: 'child', active, testID: 'route', style: { height: 240 } },
          React.createElement('input', { 'aria-label': 'Native editor' }),
          React.createElement('button', null, 'Retained content'),
        ),
      ),
    ),
  );
}

test('inactive scopes isolate unmanaged descendants without removing their DOM or layout', () => {
  const html = render(false);

  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /inert=""/);
  assert.match(html, /height:240px/);
  assert.match(html, /data-testid="route"/);
  assert.match(html, /<input aria-label="Native editor"\/>/);
  assert.match(html, /<button>Retained content<\/button>/);
});

test('an active child remains isolated under an inactive parent', () => {
  const html = render(true, false);

  assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 2);
  assert.equal((html.match(/inert=""/g) ?? []).length, 2);
});

test('active scopes reopen DOM interaction without hiding or unmounting their content', () => {
  const html = render(true);

  assert.doesNotMatch(html, /aria-hidden="true"|inert=/);
  assert.match(html, /<input aria-label="Native editor"\/>/);
  assert.match(html, /<button>Retained content<\/button>/);
});

test('custom content stays inert and hidden inside one named button', () => {
  const html = renderToStaticMarkup(
    React.createElement(
      FocusProvider,
      null,
      React.createElement(
        Focusable,
        {
          occurrenceKey: 'card',
          accessibilityLabel: 'Movie title',
          style: { width: 240, height: 140 },
        },
        React.createElement('span', null, 'Custom visual title'),
      ),
    ),
  );

  assert.match(html, /aria-label="Movie title"/);
  assert.match(html, /inert=""/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /Custom visual title/);
  assert.equal((html.match(/role="button"/g) ?? []).length, 1);
  assert.equal((html.match(/Movie title/g) ?? []).length, 1);
});
