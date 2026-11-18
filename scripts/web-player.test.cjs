const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function compile(file) {
  const source = fs.readFileSync(path.join(__dirname, '../apps/probe', file), 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true},
  }).outputText;
}
const outputText = compile('ott/src/Player.web.tsx');
const playbackTime = {};
vm.runInNewContext(compile('ott/src/playback-time.ts'), {exports: playbackTime});

// Run the component's real handlers with controlled media events, without network.
function fixture() {
  const state = [], refs = [], effects = [], listeners = new Map();
  let cursor = 0, refIndex = 0, first = true, tree, cleanup, closed = 0, back;
  const ownership = {directionalNavigationEnabled: true};
  const document = {hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name)};
  const media = {paused: true, ended: false, currentTime: 0, duration: 60, muted: false, volume: 1, loads: 0,
    play: async () => { media.paused = false; }, pause: () => { media.paused = true; },
    load: () => { media.loads++; }, removeAttribute: name => { media.removed = name; }};
  const react = {
    createElement: (type, props, ...children) => ({type, props: {...props, children: children.flat()}}),
    useCallback: fn => fn,
    useRef: value => { const i = refIndex++; refs[i] ||= {current: value}; return refs[i]; },
    useState: value => { const i = cursor++; if (first) { state[i] = value; } return [state[i], next => { state[i] = next; }]; },
    useEffect: fn => { if (first) { effects.push(fn); } },
  };
  const module = {exports: {}};
  vm.runInNewContext(outputText, {module, exports: module.exports, Error, document, require: name => {
    if (name === 'react') { return react; }
    if (name === 'react-dom') { return {createPortal: child => child}; }
    if (name === '../../web/PlaybackIcon') { return 'PlaybackIcon'; }
    if (name === './playback-time') { return playbackTime; }
    if (name === '../../web/focus-store') { return ownership; }
    if (name === '../../web/platform') { return {BackHandler: {addEventListener: (_, fn) => { back = fn; return {remove: () => { back = null; }}; }}}; }
    throw new Error(name);
  }});
  const nodes = node => !node?.props ? [] : [node, ...node.props.children.flatMap(nodes)];
  const render = () => { cursor = refIndex = 0; tree = module.exports.default({title: 'Test title', onClose: () => closed++}); first = false; return tree; };
  render(); refs[0].current = media; refs[1].current = {focus() {}};
  return {media, document, ownership, render, all: () => nodes(tree), find: label => nodes(tree).find(n => n.props['aria-label'] === label || n.props.children.includes(label)),
    mount: () => { cleanup = effects[0](); }, cleanup: () => cleanup(), back: () => back?.(), closed: () => closed,
    hide: () => { document.hidden = true; listeners.get('visibilitychange')(); }, listeners};
}

test('player starts media, exposes no fullscreen control, pauses when hidden and releases on close', async () => {
  const f = fixture(); f.mount(); await Promise.resolve();
  assert.equal(f.media.paused, false);
  const video = f.all().find(n => n.type === 'video');
  assert.equal(video.props.controls, false); assert.equal(video.props.disablePictureInPicture, true);
  assert.equal(f.all().some(n => /fullscreen/i.test(n.props['aria-label'] || '')), false);
  f.hide(); assert.equal(f.media.paused, true);
  f.find('Close player').props.onClick(); assert.equal(f.closed(), 1);
  f.cleanup(); assert.equal(f.media.removed, 'src'); assert.equal(f.listeners.size, 0); assert.equal(f.back(), undefined);
});

test('timeline and skip controls clamp seeks; replay resets an ended video; Back closes', async () => {
  const f = fixture(); f.mount();
  f.media.currentTime = 58; f.find('Forward 10 seconds').props.onClick(); assert.equal(f.media.currentTime, 60);
  f.media.currentTime = 2; f.find('Rewind 10 seconds').props.onClick(); assert.equal(f.media.currentTime, 0);
  f.find('Playback position').props.onChange({currentTarget: {value: '35'}}); assert.equal(f.media.currentTime, 35);
  f.media.ended = true; f.media.paused = true; f.find('Play').props.onClick(); await Promise.resolve(); assert.equal(f.media.currentTime, 0);
  assert.equal(f.back(), true); assert.equal(f.closed(), 1); assert.equal(f.media.paused, true);
});

test('autoplay denial offers Play; media failure offers a retry instead of an unhandled rejection', async () => {
  const f = fixture();
  f.media.play = async () => { throw Object.assign(new Error('denied'), {name: 'NotAllowedError'}); };
  f.mount(); await new Promise(resolve => setImmediate(resolve)); f.render();
  assert.ok(f.find('Press Play to start.')); assert.ok(f.find('Play'));
  f.all().find(n => n.type === 'video').props.onError(); f.render(); assert.ok(f.find('Retry'));
  f.media.play = async () => { f.media.paused = false; };
  f.find('Retry').props.onClick(); await Promise.resolve(); assert.equal(f.media.loads, 1); assert.equal(f.media.paused, false);
});

test('player keeps Tab inside its controls and leaves native slider adjustment and reader arrows alone', () => {
  const f = fixture(); const controls = ['BUTTON', 'INPUT', 'BUTTON'].map(tagName => ({tagName, focus() { this.focused = true; }}));
  let prevented = false;
  const event = {key: 'Tab', target: controls[2], currentTarget: {querySelectorAll: () => controls}, preventDefault() { prevented = true; }, stopPropagation() {}};
  f.render().props.onKeyDown(event); assert.equal(controls[0].focused, true); assert.equal(prevented, true);
  prevented = false; event.key = 'ArrowRight'; event.target = controls[1]; f.render().props.onKeyDown(event); assert.equal(prevented, false);
  f.ownership.directionalNavigationEnabled = false; event.target = controls[0]; f.render().props.onKeyDown(event); assert.equal(prevented, false);
});
