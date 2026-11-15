/* eslint-env node, es2022 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

// Exercise the actual web component's option gate; DOM effects are not run here.
const output = ts.transpileModule(
  readFileSync(require.resolve('../rails.tsx'), 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  },
).outputText;

const record = { exports: {} };
const scope = React.createContext({ path: [], key: '', active: true });

vm.runInNewContext(output, {
  module: record,
  exports: record.exports,
  require(name) {
    if (name === 'react') {
      return React;
    }

    if (name === 'react-native') {
      return require('react-native-web');
    }

    if (name === './focus') {
      return {
        WebScopeContext: scope,
        useWebStore: () => ({}),
        useFocusState: () => ({}),
        FocusScope: ({ children }) =>
          React.createElement('section', null, children),
      };
    }

    if (name === './focus-store') {
      return { createNode: (key, parent) => ({ key, parent }) };
    }

    if (name === './window') {
      return { visibleIndices: () => [] };
    }

    if (name.endsWith('/api/types')) {
      return { nativeScopeKey: JSON.stringify };
    }

    if (name.endsWith('/api/viewport')) {
      return {};
    }

    throw new Error(`Unexpected import ${name}`);
  },
});

test('web rails accept both entry policies and reject invalid values', () => {
  const props = {
    id: 'rows',
    rails: [],
    rowExtent: 100,
    itemExtent: 80,
    viewportExtent: 320,
  };

  const render = rowEntry =>
    renderToStaticMarkup(
      React.createElement(record.exports.FocusVirtualizedRails, {
        ...props,
        rowEntry,
      }),
    );

  assert.equal(render(), render('nearest'));
  assert.doesNotThrow(() => render('first'));

  for (const value of ['typo', 1, null]) {
    assert.throws(() => render(value), /rowEntry.*nearest/);
  }
});

test('web rails validate horizontal alignment', () => {
  const render = horizontalAlignment =>
    renderToStaticMarkup(
      React.createElement(record.exports.FocusVirtualizedRails, {
        id: 'rows',
        rails: [],
        rowExtent: 100,
        itemExtent: 80,
        viewportExtent: 320,
        horizontalAlignment,
      }),
    );

  assert.equal(render(), render('nearest'));
  assert.doesNotThrow(() => render('leading'));

  for (const value of ['center', 1, null]) {
    assert.throws(() => render(value), /horizontalAlignment/);
  }
});
