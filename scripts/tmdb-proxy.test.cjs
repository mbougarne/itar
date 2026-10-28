const {test} = require('node:test');
const http = require('node:http');
const assert = require('node:assert/strict');
const {createProxy} = require('./tmdb-proxy.cjs');
const {mockTmdb} = require('./tmdb-mock.cjs');
async function run(options, check) {
  const server = createProxy(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await check(base); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test('mock server returns paged metadata/cast without credentials or external fetches', async () => {
  await run({mock: true, fetcher: () => { throw new Error('External fetch forbidden'); }}, async base => {
    const first = await (await fetch(`${base}/v1/catalogue?kind=all`)).json();
    assert.equal(first.source, 'tmdb-mock'); assert.equal(first.rows.length, 4);
    const id = first.rows[0].entries[0].id;
    const next = await (await fetch(`${base}/v1/catalogue?kind=all&cursor=${first.nextCursor}`)).json();
    assert.notEqual(next.rows[0].id, first.rows[0].id);
    const details = await (await fetch(`${base}/v1/details?id=${id}`)).json();
    assert.equal(details.film.id, id); assert.equal(details.cast[0].name, 'Mock Cast Member');
    assert.equal(details.related.length, 6);assert.ok(details.related.every(item => item.id !== id && item.source === 'tmdb-mock'));
    const person = await (await fetch(`${base}/v1/person?id=9001`)).json();
    assert.match(person.bio, /mock biography/);
  });
});
test('live adapter sends only to fixed HTTPS TMDB origin and never returns the mock secret', async () => {
  const fake = 'mock-server-credential-not-a-real-key'; let calls = 0;
  await run({mock: false, apiKey: fake, fetcher: async (url, options) => {
    calls += 1; assert.equal(url.origin, 'https://api.themoviedb.org');
    assert.equal(url.searchParams.get('api_key'), fake); assert.equal(options.redirect, 'error');
    const value = mockTmdb(url.pathname.replace('/3', ''), {page: 1});
    value.results[0].title = fake; value.api_key = fake;
    return new Response(JSON.stringify(value));
  }}, async base => {
    const response = await fetch(`${base}/v1/catalogue?kind=movie`); const raw = await response.text();
    assert.equal(response.status, 200); assert.ok(!raw.includes(fake)); assert.ok(!raw.includes('api_key'));
    assert.match(raw, /redacted/); assert.equal(calls, 1);
  });
});
test('rejects arbitrary endpoints, injected IDs, foreign and malformed cursors, and writes', async () => {
  await run({mock: true}, async base => {
    const page = await (await fetch(`${base}/v1/catalogue?kind=movie`)).json();
    for (const [route, status] of [['/v1/fetch?url=http://example.invalid', 404], ['/v1/details?id=../../etc/passwd', 400],
      ['/v1/catalogue?kind=invalid', 400], ['/v1/catalogue?cursor=invalid', 400], [`/v1/catalogue?kind=series&cursor=${page.nextCursor}`, 400]]) {
      assert.equal((await fetch(base + route)).status, status, route);
    }
    assert.equal((await fetch(`${base}/v1/catalogue`, {method: 'POST'})).status, 405);
    assert.equal((await fetch(`${base}/health`, {headers: {Origin: 'https://example.invalid'}})).status, 403);
    const foreignHost = await new Promise((resolve, reject) => {
      http.get(`${base}/health`, {headers: {Host: 'example.invalid'}}, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
    assert.equal(foreignHost, 403);
  });
});
test('upstream errors are sanitized instead of exposing URLs or credential-bearing exception text', async () => {
  const fake = 'dummy-secret-only-for-this-test';
  await run({mock: false, apiKey: fake, fetcher: async () => { throw new Error(`https://example.invalid/?api_key=${fake}`); }}, async base => {
    const response = await fetch(`${base}/v1/catalogue?kind=movie`);const raw = await response.text();
    assert.equal(response.status, 502); assert.ok(!raw.includes(fake)); assert.ok(!raw.includes('example.invalid'));
  });
});
test('bounded concurrency rejects a fifth in-flight upstream request', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  let ready; const started = new Promise(resolve => { ready = resolve; }); let count = 0;
  await run({mock: false, apiKey: 'dummy-test-key', fetcher: async () => {
    count += 1;if (count === 4) { ready(); } await gate;
    return new Response(JSON.stringify(mockTmdb('/movie/popular', {page: 1})));
  }}, async base => {
    const first = Array.from({length: 4}, () => fetch(`${base}/v1/catalogue?kind=movie`));
    await started;assert.equal((await fetch(`${base}/v1/catalogue?kind=movie`)).status, 429);
    release();for (const response of await Promise.all(first)) { assert.equal(response.status, 200); await response.arrayBuffer(); }
  });
});
