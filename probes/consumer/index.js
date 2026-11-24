const React = require('react');
const { AppRegistry } = require('react-native');
const { Focusable, FocusProvider } = require('@bougarnem/itar/react');
const { name } = require('./app.json');

function TestSurface() {
  return React.createElement(
    FocusProvider,
    { style: { flex: 1 } },
    React.createElement(Focusable, {
      occurrenceKey: 'native-test-target',
      accessibilityLabel: 'Native test target',
      style: { width: 200, height: 80 },
    }),
  );
}

AppRegistry.registerComponent(name, () => TestSurface);
