const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function evaluate(file, imports, globals = {}) {
  const source = readFileSync(path.join(__dirname, '..', file), 'utf8');
  const {outputText} = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true},
  });
  const module = {exports: {}};
  vm.runInNewContext(outputText, {module, exports: module.exports, require: imports, ...globals});
  return module.exports;
}
const {occurrenceKey} = evaluate('packages/itar/src/api/types.ts');
const {layoutRows} = evaluate('apps/probe/ott/src/browse-layout.ts');
const film = {id: 'title-b', title: 'Title B', kind: 'movie', year: 2026, category: 'Drama', synopsis: '', art: 0};
const recommendation = {...film, id: 'title-c', title: 'Title C'};
const catalogue = {hero: film, films: [film, recommendation], cast: [], categories: ['All', 'Drama']};
const nodes = node => !node?.props ? [] : [node, ...node.props.children.flatMap(nodes)];

test('details keep decorative glyphs visual and accessible names plain', () => {
  const f = fixture('');
  const details = f.component('Details', {film, active: true, onPlay() {}, onOpen() {}, highContrast: false});
  assert.equal(details.find('Action', 'Play demo').props.displayLabel, '▶  Play demo');
  assert.equal(details.find('Action', 'My list').props.displayLabel, '＋  My list');
});

test('web Search recovers only its own focused edit control when the query becomes empty', () => {
  for (const platform of ['web', 'android']) {
    for (const action of ['Clear', 'Delete']) {
      for (const ownsFocus of [true, false]) {
        const id = 'search';
        const key = occurrenceKey(id, action.toLowerCase());
        const f = fixture(ownsFocus ? key : 'unrelated', 'applied', platform);
        const search = f.component('Search', {id, active: true});
        search.find('Action', 'A').props.onPress(); search.render();
        search.find('Action', action).props.onPress(); search.render();
        assert.equal(search.find('Action', action).props.enabled, false);
        assert.deepEqual(f.requests, platform === 'web' && ownsFocus ? [occurrenceKey(id, 'key', 'A')] : []);
      }
    }
  }
  const f = fixture(occurrenceKey('search', 'delete'), 'applied', 'web');
  const search = f.component('Search', {id: 'search', active: true});
  for (const letter of ['A', 'B']) { search.find('Action', letter).props.onPress(); search.render(); }
  search.find('Action', 'Delete').props.onPress(); search.render();
  assert.equal(search.find('Action', 'Delete').props.enabled, true);
  assert.deepEqual(f.requests, [], 'ordinary deletion must keep its current focus');
});

test('initial web retry waits for committed results and respects focus ownership and repeated failure', () => {
  for (const platform of ['web', 'android']) {
    for (const ownsFocus of [true, false]) {
      const id = 'catalogue';
      const f = fixture(ownsFocus ? occurrenceKey(id, 'load-more') : 'elsewhere', 'applied', platform);
      Object.assign(f.catalogueState, {rows: [], error: 'failed', ended: false});
      const browse = f.component('Browse', {id, active: true, grid: true, mode: 'fixture', kind: 'movie'});
      browse.layout();
      const retry = () => browse.find('Rails').props.rails.at(-1).items[0].onPress();
      const ready = () => browse.find('Rails').props.onReady();
      retry();
      Object.assign(f.catalogueState, {loading: true, error: ''}); browse.render(); ready();
      assert.deepEqual(f.requests, [], 'loading cannot focus a speculative result');
      Object.assign(f.catalogueState, {loading: false, error: 'again'}); browse.render(); ready();
      assert.deepEqual(f.requests, [], 'another failure must preserve usable Retry');
      retry();
      Object.assign(f.catalogueState, {error: '', ended: true, rows: [{id: 'first', entries: [film]}]});
      browse.render(); ready();
      assert.equal(f.loadCalls(), 2);
      assert.deepEqual(f.requests, platform === 'web' && ownsFocus ? [occurrenceKey(id, 'grid-0', film.id)] : []);
    }
  }
});

// Run the real component callbacks and effects without rendering native views.
// The command double records intent; it cannot establish reader-owned focus.
function fixture(inputKey, outcome = 'applied', platform = 'android') {
  let current, back;
  const requests = [];
  const requestKinds = [];
  const issue = (kind, key) => {
    requests.push(key); requestKinds.push(kind);
    return {cancel() {}, result: Promise.resolve({status: outcome})};
  };
  const commands = {focusByKey: key => issue('focus', key), restoreFocusByKey: key => issue('restore', key)};
  const react = {
    createElement: (type, props, ...children) => ({type, props: {...props, children: children.flat(Infinity)}}),
    useState: initial => {
      const owner = current, i = owner.stateIndex++;
      if (!(i in owner.states)) { owner.states[i] = typeof initial === 'function' ? initial() : initial; }
      return [owner.states[i], next => {
        const value = typeof next === 'function' ? next(owner.states[i]) : next;
        if (!Object.is(value, owner.states[i])) { owner.states[i] = value; owner.dirty = true; }
      }];
    },
    useRef: initial => {
      const i = current.refIndex++;
      current.refs[i] ||= {current: initial};
      return current.refs[i];
    },
    useMemo: callback => callback(), useCallback: callback => callback,
    useEffect: (callback, deps) => {
      const owner = current, i = owner.effectIndex++, previous = owner.effects[i];
      if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) {
        owner.pending.push(() => { previous?.cleanup?.(); owner.effects[i] = {deps, cleanup: callback()}; });
      }
    },
  };
  const focus = {kind: 'managed', occurrenceKey: inputKey};
  const catalogueState = {loading: false, error: '', ended: true, limitReached: false,
    rows: ['first', 'second'].map(id => ({id, title: id, entries: [film]}))};
  let loadCalls = 0;
  const imports = name => {
    if (name === 'react') { return react; }
    if (name === 'react-native') {
      return {View: 'View', Text: 'Text', Image: 'Image', ScrollView: 'ScrollView', Platform: {OS: platform, isTV: true},
        useWindowDimensions: () => ({width: 1920}), BackHandler: {addEventListener: (_, callback) => {
          back = callback; return {remove() {}};
        }}};
    }
    if (name === 'itar/react') {
      return {FocusProvider: 'FocusProvider', FocusScope: 'FocusScope', FocusVirtualizedRails: 'Rails', occurrenceKey,
        useFocusCommands: () => commands, useFocusReady: () => true, useFocusState: () => focus,
        useIsFocused: key => focus.kind === 'managed' && focus.occurrenceKey === key};
    }
    if (name.endsWith('/theme')) { return {DesignTheme: 'Theme', useDesign: () => ({s: {}, u: 1})}; }
    if (name.endsWith('/ui')) { return {Action: 'Action', Backdrop: 'Backdrop', Header: 'Header', Picture: 'Picture', icons: {}, art: []}; }
    if (name === './catalog') { return catalogue; }
    if (name === './browse-layout') { return {layoutRows}; }
    if (name === './guide') { return {useGuide: () => ({guide: null})}; }
    if (name === './useCatalogue') {
      return {useCatalogue: () => ({state: catalogueState, loadMore: () => { loadCalls++; }, reload() {}, nextWindow() {}})};
    }
    if (name === './tmdb') { return {fetchDetails: () => Promise.resolve({film: {...film, id: 'enriched-b', title: 'Enriched B'}})}; }
    if (name === './src/browser-session') { return {readBrowserSession: () => ({mode: 'fixture', profile: 'Explorer'}), saveBrowserSession() {}}; }
    if (name === './src/Preferences') { return {Profiles: 'Profiles', Settings: 'Settings'}; }
    if (name.endsWith('.png')) { return 0; }
    if (/^\.\/(src\/)?(Auth|Epg|Browse|Catalogue|Search|Details|Player|Hero)$/.test(name)) {
      return {__esModule: true, default: name.split('/').at(-1), Metadata: 'Metadata'};
    }
    throw new Error(`Unexpected import ${name}`);
  };
  const load = name => evaluate(`apps/probe/ott/${name}.tsx`, imports, {
    AbortController, setTimeout: callback => { callback(); return 1; }, clearTimeout() {},
  }).default;
  function mount(component, props) {
    const owner = {states: [], refs: [], effects: [], pending: []};
    const render = () => {
      let passes = 0;
      do {
        assert.ok(passes++ < 15, 'component effects must settle');
        current = owner; owner.dirty = false;
        owner.stateIndex = owner.refIndex = owner.effectIndex = 0;
        owner.tree = component(props);
        owner.pending.splice(0).forEach(run => run());
      } while (owner.dirty);
    };
    render();
    return {render, tree: () => owner.tree,
      find: (type, label) => nodes(owner.tree).find(node => node.type === type && (!label || node.props.label === label)),
      layout: () => {
        nodes(owner.tree).filter(node => node.props.onLayout).forEach(node =>
          node.props.onLayout({nativeEvent: {layout: {width: 1200, height: 800}}}));
        render();
      }};
  }
  const child = instance => instance.tree().props.children[0];
  const root = mount(load('App'), {});
  const launch = mount(child(root).type, child(root).props);
  const tv = mount(launch.tree().type, launch.tree().props);
  const app = mount(child(tv).type, child(tv).props);
  const component = (name, props) => mount(load(`src/${name}`), props);
  return {app, component, requests, requestKinds, catalogueState, loadCalls: () => loadCalls,
    navigate: screen => { app.find('Action', screen).props.onPress(); app.render(); },
    ready: () => { app.find('Details').props.onReady(); app.render(); },
    close: () => { assert.equal(back(), true); app.render(); },
  };
}

test('Search returns to the activated duplicate occurrence while input focus stays on A', async () => {
  const page = 'Explorer:fixture:Search';
  const f = fixture(occurrenceKey(page, 'key', 'A'), 'unavailable');
  f.navigate('Search');
  const search = f.component('Search', f.app.find('Search').props);
  const browse = f.component('Browse', search.find('Browse').props);
  browse.layout();
  const rails = browse.find('Rails').props;
  rails.onReady(); f.app.render();
  const first = rails.rails[0].items[0], second = rails.rails[1].items[0];
  assert.equal(first.contentId, second.contentId);
  assert.notEqual(first.occurrenceKey, second.occurrenceKey);
  second.onPress(); f.app.render(); f.ready(); f.close();
  f.app.find('Search').props.onReady(occurrenceKey(page, 'key', 'A'));
  assert.equal(f.requests.at(-1), second.occurrenceKey, 'return must use activated B, not input-focused A');
  assert.deepEqual(f.requestKinds, ['focus', 'focus', 'restore'], 'only the Android return has restoration authority');
  await Promise.resolve(); f.app.render();
  assert.ok(nodes(f.app.tree()).some(node => node.props.children.includes('Continue with your remote.')),
    'an unavailable request must retain the existing manual-navigation notice');
});

test('category cards pass their scoped key and recommendation chains preserve that opener', () => {
  const f = fixture(occurrenceKey('nav', 'Movies'));
  f.navigate('Movies');
  const category = f.component('Catalogue', f.app.find('Catalogue').props);
  category.find('Action', 'Drama').props.onPress(); category.render();
  const browse = f.component('Browse', category.find('Browse').props);
  browse.layout();
  const rails = browse.find('Rails').props;
  rails.onReady(); f.app.render();
  const opener = rails.rails[0].items[0];
  assert.equal(opener.occurrenceKey, occurrenceKey('Explorer:fixture:Movies:Drama', 'grid-0', film.id));
  opener.onPress(); f.app.render(); f.ready();
  for (let step = 0; step < 2; step++) {
    const props = f.app.find('Details').props;
    let activatedKey;
    const details = f.component('Details', {...props, onOpen: (value, key) => {
      activatedKey = key; props.onOpen(value, key);
    }});
    details.layout();
    const next = details.find('Rails').props.rails[0].items[0];
    next.onPress(); f.app.render();
    assert.equal(activatedKey, next.occurrenceKey);
    f.ready();
  }
  f.close();
  f.app.find('Catalogue').props.onReady(occurrenceKey('Movies', 'category', 'All'));
  assert.equal(f.requests.at(-1), opener.occurrenceKey);
});

test('Android holds automatic page entry until its exact return request settles', async () => {
  const f = fixture(occurrenceKey('nav', 'Movies'));
  const pageScope = () => nodes(f.app.tree()).find(node => node.type === 'FocusScope' && node.props.id === 'page');
  f.navigate('Movies');
  assert.equal(pageScope().props.entryReady, true, 'initial native reader entry remains available');
  const props = f.app.find('Catalogue').props;
  const initial = occurrenceKey(props.id, 'category', 'All');
  const opener = occurrenceKey(`${props.id}:All`, 'grid-0', film.id);
  props.onReady(initial); await Promise.resolve(); f.app.render();
  props.onOpen(film, opener); f.app.render();
  assert.equal(nodes(f.app.tree()).find(node => node.type === 'FocusScope' && node.props.id === 'details').props.entryReady, true);
  // The native reader can activate details before its collection is ready.
  f.close();
  assert.equal(pageScope().props.entryReady, false, 'fallback must wait before restoration dispatch');
  assert.equal(pageScope().props.preferredKey, opener, 'only the exact opener may receive native fallback');
  assert.equal(pageScope().props.accessibilityPaneTitle, undefined, 'reader route change must wait for restoration');
  f.app.find('Catalogue').props.onReady(initial); f.app.render();
  assert.equal(f.requests.at(-1), opener);
  assert.equal(f.requestKinds.at(-1), 'restore');
  assert.equal(pageScope().props.entryReady, false, 'dispatch alone must not reopen automatic entry');
  await Promise.resolve(); f.app.render();
  assert.equal(pageScope().props.entryReady, true, 'reopen after the request settles');
  assert.equal(pageScope().props.preferredKey, undefined, 'return preference must not change later navigation');
  assert.equal(pageScope().props.accessibilityPaneTitle, 'Movies', 'publish the completed reader route');
});

test('Hero opens enriched details but returns to its original rendered occurrence', async () => {
  const f = fixture(occurrenceKey('nav', 'Home'));
  const props = f.app.find('Browse').props;
  const hero = f.component('Hero', {id: props.id, film: {...film, source: 'tmdb'}, onOpen: props.onOpen});
  await Promise.resolve(); hero.render();
  const explore = hero.find('Action', 'Explore title');
  assert.equal(explore.props.id, occurrenceKey(props.id, 'hero', film.id));
  explore.props.onPress(); f.app.render();
  assert.equal(f.app.find('Details').props.film.id, 'enriched-b');
  f.ready(); f.close();
  f.app.find('Browse').props.onReady(occurrenceKey(props.id, 'load-more'));
  assert.equal(f.requests.at(-1), explore.props.id);
});

for (const platform of ['ios', 'web']) {
  test(`${platform} retains generic focus for initial entry and details return`, () => {
    const f = fixture(occurrenceKey('nav', 'Home'), 'applied', platform);
    const props = f.app.find('Browse').props;
    const key = occurrenceKey(props.id, 'hero', film.id);
    props.onReady(key); f.app.render();
    props.onOpen(film, key); f.app.render(); f.ready(); f.close();
    f.app.find('Browse').props.onReady('initial');
    assert.deepEqual(f.requestKinds, ['focus', 'focus', 'focus']);
    assert.equal(f.requests.at(-1), key);
  });
}

for (const opener of ['Hero', 'preview']) {
  test(`Android guide return restores the activated ${opener} occurrence`, () => {
    const f = fixture(occurrenceKey('nav', 'Home'));
    const browse = f.component('Browse', f.app.find('Browse').props);
    browse.layout();
    const rails = browse.find('Rails').props;
    rails.onReady(); f.app.render();
    const action = opener === 'Hero'
      ? f.component('Hero', rails.listHeader.props).find('Action', 'TV guide').props
      : rails.rails.find(rail => rail.id === 'guide-preview').items[0];
    action.onPress(); f.app.render();
    f.app.find('Epg').props.onClose(); f.app.render();
    f.app.find('Browse').props.onReady('initial');
    assert.equal(f.requests.at(-1), action.id ?? action.occurrenceKey);
    assert.deepEqual(f.requestKinds, ['focus', 'restore']);
  });
}
