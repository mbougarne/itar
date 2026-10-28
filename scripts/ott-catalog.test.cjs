const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, mkdtempSync, writeFileSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const temporary = mkdtempSync(path.join(tmpdir(), 'itar-ott-catalog-'));
let catalog, CatalogueSession;
try {
  for (const name of ['catalog', 'session']) {
    const compiled = ts.transpileModule(readFileSync(path.join(__dirname, `../apps/probe/ott/src/${name}.ts`), 'utf8'), {
      compilerOptions: {module: ts.ModuleKind.CommonJS},
    });
    writeFileSync(path.join(temporary, `${name}.js`), compiled.outputText);
  }
  catalog = require(path.join(temporary, 'catalog.js'));
  ({CatalogueSession} = require(path.join(temporary, 'session.js')));
} finally { rmSync(temporary, {recursive: true}); }
const options = () => ({signal: new AbortController().signal, delay: 0});
test('stable unique catalogue and cast IDs, honest metadata-only fixtures', () => {
  assert.equal(catalog.films.length, 96);
  assert.equal(new Set(catalog.films.map(film => film.id)).size, 96);
  assert.equal(new Set(catalog.cast.map(member => member.id)).size, 4);
  for (const film of catalog.films) {
    assert.ok(film.title && film.synopsis && film.art >= 0 && film.art < 8);
    assert.equal('playableRef' in film, false);
  }
});
test('pagination appends distinct rows, two landscape and two poster rows per page, then ends', async () => {
  const first = await catalog.fetchPage('all', '', null, options());
  const second = await catalog.fetchPage('all', '', first.nextCursor, options());
  assert.deepEqual(first.rows.map(row => row.format), ['landscape', 'landscape', 'poster', 'poster']);
  assert.equal(new Set([...first.rows, ...second.rows].map(row => row.id)).size, 8);
  assert.equal(second.nextCursor, null);
  assert.equal(first.source, 'simulated-local');
  assert.ok(first.rows[0].entries.includes(catalog.hero));
  assert.equal(new Set([...first.rows, ...second.rows].flatMap(row => row.entries.map(film => film.id))).size, 48);
  assert.ok(first.rows.flatMap(row => row.entries).some(film => film.kind === 'series'));
});
test('Movies/Series filtering, search normalization, empty results and cursor isolation', async () => {
  for (const kind of ['movie', 'series']) {
    const page = await catalog.fetchPage(kind, '', null, options());
    assert.ok(page.rows.flatMap(row => row.entries).every(film => film.kind === kind));
  }
  const matches = await catalog.fetchPage('all', ' ATLAS ', null, options());
  assert.ok(matches.rows.flatMap(row => row.entries).every(film => film.title.includes('Atlas')));
  assert.deepEqual((await catalog.fetchPage('all', 'missing-title', null, options())).rows, []);
  const page = await catalog.fetchPage('movie', '', null, options());
  await assert.rejects(catalog.fetchPage('series', '', page.nextCursor, options()), /Cursor/);
  await assert.rejects(catalog.fetchPage('movie', '', 'movie//NaN', options()), /Cursor/);
});
test('aborting an asynchronous fetch rejects without returning a page', async () => {
  const controller = new AbortController();
  const pending = catalog.fetchPage('all', '', null, {signal: controller.signal, delay: 20});
  controller.abort();
  await assert.rejects(pending, {name: 'AbortError'});
  await assert.rejects(catalog.fetchPage('all', '', null, {signal: controller.signal, delay: 0}), {name: 'AbortError'});
});
test('rapid end events coalesce, failure keeps prior rows, retry appends exactly once', async () => {
  let fail = false, calls = 0;
  const session = new CatalogueSession('movie', '', () => ({delay: 0, fail}), (...args) => { calls += 1; return catalog.fetchPage(...args); });
  await session.start();
  const original = session.snapshot().rows;
  fail = true;
  await Promise.all([session.loadMore(), session.loadMore(), session.loadMore()]);
  assert.equal(calls, 2);
  assert.equal(session.snapshot().rows, original);
  assert.match(session.snapshot().error, /Simulated/);
  fail = false;
  await session.loadMore();
  assert.equal(session.snapshot().rows.length, 8);
  await session.loadMore();
  assert.equal(calls, 3);
  session.dispose();
});
test('a disposed/restarted request cannot overwrite new state even when transport ignores abort', async () => {
  const resolvers = [];
  const session = new CatalogueSession('all', '', () => ({delay: 0, fail: false}), () => new Promise(resolve => resolvers.push(resolve)));
  const old = session.start();
  const next = session.start();
  resolvers[1]({rows: [{id: 'new', title: 'New', format: 'landscape', entries: [catalog.films[0]]}], nextCursor: null, source: 'simulated-local'});
  await next;
  resolvers[0]({rows: [{id: 'old', title: 'Old', format: 'landscape', entries: [catalog.films[1]]}], nextCursor: null, source: 'simulated-local'});
  await old;
  assert.equal(session.snapshot().rows[0].id, 'new');
  session.dispose();
});

test('a larger provider preserves prior targets and explicitly caps the viewing window at48', async () => {
  let page = 0;
  const session = new CatalogueSession('all', '', () => ({delay: 0, fail: false}), async () => {
    const entries = catalog.films.slice(page * 20, ++page * 20);
    return {rows: [{id: `page-${page}`, title: 'Page', format: 'landscape', entries}], nextCursor: String(page), source: 'tmdb-mock'};
  });
  await session.start();const original = session.snapshot().rows[0];
  await session.loadMore();await session.loadMore();
  assert.equal(session.snapshot().rows.reduce((count, row) => count + row.entries.length, 0), 48);
  assert.equal(session.snapshot().rows[0], original);
  assert.equal(session.snapshot().ended, true);assert.equal(session.snapshot().limitReached, true);
  await session.loadMore();assert.equal(page, 3);session.dispose();
});
