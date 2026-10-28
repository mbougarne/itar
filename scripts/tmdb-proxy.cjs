// Standalone local backend. This module must never be imported by React Native.
const http = require('node:http');
const {readFile} = require('node:fs/promises');
const path = require('node:path');
const {mockTmdb} = require('./tmdb-mock.cjs');
const API = 'https://api.themoviedb.org/3';
const IMAGE = 'https://image.tmdb.org/t/p/';
const notice = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';
const image = (value, size) => typeof value === 'string' && /^\/[\w.-]+\.(jpg|png|webp)$/.test(value) ? `${IMAGE}${size}${value}` : null;
const text = (value, limit = 4000) => typeof value === 'string' ? value.slice(0, limit) : '';
const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
function mapFilm(item, kind, mock) {
  if (!validId(item.id)) { return null; }
  return {id: `tmdb:${kind}:${item.id}`, title: text(kind === 'movie' ? item.title : item.name, 200) || 'Untitled',
    kind, category: Array.isArray(item.genres) ? item.genres.map(g => text(g.name, 40)).filter(Boolean).join(' / ') : kind === 'movie' ? 'Movie' : 'Series',
    year: Number(text(kind === 'movie' ? item.release_date : item.first_air_date, 4)) || 0,
    synopsis: text(item.overview) || 'No synopsis available.', art: 0, source: mock ? 'tmdb-mock' : 'tmdb',
    posterUrl: mock ? `http://127.0.0.1:8787/v1/mock-art/${item.id % 8}` : image(item.poster_path, 'w500'),
    backdropUrl: mock ? `http://127.0.0.1:8787/v1/mock-art/${item.id % 8}` : image(item.backdrop_path, 'w1280')};
}
function createProxy({apiKey = '', mock = true, fetcher = fetch} = {}) {
  let active = 0;
  const upstream = async (route, params, signal) => {
    if (mock) { return mockTmdb(route, params); }
    if (!apiKey) { throw new Error('TMDB credentials are not configured on the server.'); }
    const url = new URL(API + route);
    for (const [key, value] of Object.entries(params)) { url.searchParams.set(key, String(value)); }
    url.searchParams.set('api_key', apiKey);
    const result = await fetcher(url, {signal, redirect: 'error', headers: {Accept: 'application/json'}});
    if (!result.ok) { throw new Error(`TMDB request failed (HTTP ${result.status}).`); }
    if (!result.body) { throw new Error('TMDB returned an empty response.'); }
    const reader = result.body.getReader(); const chunks = []; let size = 0;
    while (true) {
      const part = await reader.read(); if (part.done) { break; }
      size += part.value.byteLength;
      if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('TMDB response exceeded the local limit.'); }
      chunks.push(Buffer.from(part.value));
    }
    return JSON.parse(Buffer.concat(chunks, size).toString());
  };
  return http.createServer(async (req, res) => {
    const send = (status, value) => {
      // Whitelist mapping above and last-resort redaction prevent upstream key echoes.
      let body = JSON.stringify(value);
      if (apiKey) { body = body.split(apiKey).join('[redacted]'); }
      res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
      res.end(body);
    };
    if (req.headers.origin || !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) { send(403, {error: 'Local native clients only'}); return; }
    if (req.method !== 'GET') { send(405, {error: 'GET only'}); return; }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/health') { send(200, {mode: mock ? 'mock' : 'live', provider: 'TMDB'}); return; }
    if (mock && /^\/v1\/mock-art\/[0-7]$/.test(url.pathname)) {
      const names = ['atlas', 'night', 'tide', 'signal', 'glass', 'letters', 'lights', 'home'];
      const file = path.resolve(__dirname, '../apps/probe/ott/assets/cinematic', `${names[Number(url.pathname.slice(-1))]}.jpg`);
      try { const body = await readFile(file); res.writeHead(200, {'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=300'}); res.end(body); }
      catch { send(404, {error: 'Mock artwork unavailable'}); }
      return;
    }
    if (!['/v1/catalogue', '/v1/details', '/v1/person'].includes(url.pathname)) { send(404, {error: 'Unknown proxy endpoint'}); return; }
    if (active >= 4) { send(429, {error: 'Local proxy busy. Retry shortly.'}); return; }
    active += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    res.on('close', () => { if (!res.writableEnded) { controller.abort(); } });
    try {
      if (url.pathname === '/v1/catalogue') {
        const kind = url.searchParams.get('kind') || 'all';
        const query = (url.searchParams.get('query') || '').trim().toLowerCase();
        if (!['all', 'movie', 'series'].includes(kind) || query.length > 80) { send(400, {error: 'Invalid catalogue query'}); return; }
        let page = 1;
        const cursor = url.searchParams.get('cursor');
        if (cursor) {
          let decoded;
          try { decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString()); }
          catch { send(400, {error: 'Invalid cursor'}); return; }
          if (!decoded || typeof decoded !== 'object') { send(400, {error: 'Invalid cursor'}); return; }
          if (decoded.kind !== kind || decoded.query !== query || !Number.isInteger(decoded.page) || decoded.page < 2 || decoded.page > 50) {
            send(400, {error: 'Cursor does not belong to this query'}); return;
          }
          page = decoded.page;
        }
        const type = kind === 'series' ? 'tv' : kind;
        const route = query ? `/search/${type === 'all' ? 'multi' : type}` : kind === 'all' ? '/trending/all/week' : `/${type}/popular`;
        const result = await upstream(route, {page, language: 'en-US', include_adult: false, ...(query ? {query} : {})}, controller.signal);
        if (!Array.isArray(result.results)) { throw new Error('TMDB returned an invalid catalogue.'); }
        const seen = new Set();
        const films = result.results.slice(0, 20).flatMap(item => {
          const media = kind === 'all' ? item.media_type : type;
          if (!['movie', 'tv'].includes(media) || item.adult === true) { return []; }
          const film = mapFilm(item, media === 'tv' ? 'series' : 'movie', mock);
          if (!film || seen.has(film.id)) { return []; }
          seen.add(film.id); return [film];
        });
        const rows = Array.from({length: Math.ceil(films.length / 5)}, (_, i) => ({id: `tmdb-page-${page}-row-${i}`,
          title: ['Popular stories', 'Worth exploring', 'The poster collection', 'More discoveries'][i], format: i < 2 ? 'landscape' : 'poster', entries: films.slice(i * 5, i * 5 + 5)}));
        const nextCursor = page < Math.min(Number(result.total_pages) || 1, 50)
          ? Buffer.from(JSON.stringify({kind, query, page: page + 1})).toString('base64url') : null;
        send(200, {rows, nextCursor, source: mock ? 'tmdb-mock' : 'tmdb', attribution: notice});
      } else if (url.pathname === '/v1/details') {
        const match = /^tmdb:(movie|series):(\d+)$/.exec(url.searchParams.get('id') || '');
        if (!match || !validId(match[2])) { send(400, {error: 'Invalid title identity'}); return; }
        const result = await upstream(`/${match[1] === 'movie' ? 'movie' : 'tv'}/${match[2]}`, {append_to_response: 'credits,recommendations,similar', language: 'en-US'}, controller.signal);
        const film = mapFilm(result, match[1], mock);
        if (!film) { throw new Error('TMDB returned invalid details.'); }
        const castIds = new Set();
        const rawCast = Array.isArray(result.credits?.cast) ? result.credits.cast.slice(0, 6) : [];
        const rawCrew = (Array.isArray(result.credits?.crew) ? result.credits.crew : []).filter(p => ['Director', 'Writer', 'Creator', 'Executive Producer'].includes(p.job)).slice(0, 2);
        const cast = [...rawCast, ...rawCrew].flatMap(p => {
          if (!validId(p.id) || castIds.has(String(p.id))) { return []; }
          castIds.add(String(p.id));
          return [{id: String(p.id), name: text(p.name, 120), role: text(p.character || p.job, 120) || 'Cast', portraitUrl: mock ? null : image(p.profile_path, 'w185')}];
        });
        const seen = new Set([film.id]);
        const recommended = Array.isArray(result.recommendations?.results) ? result.recommendations.results : [];
        const related = (recommended.length ? recommended : Array.isArray(result.similar?.results) ? result.similar.results : []).slice(0, 12).flatMap(item => {
          if (item.adult === true) { return []; }
          const mapped = mapFilm(item, match[1], mock);
          if (!mapped || seen.has(mapped.id)) { return []; }
          seen.add(mapped.id); return [mapped];
        });
        send(200, {film, cast, related, source: mock ? 'tmdb-mock' : 'tmdb', attribution: notice});
      } else {
        const id = url.searchParams.get('id');
        if (!validId(id)) { send(400, {error: 'Invalid person identity'}); return; }
        const result = await upstream(`/person/${id}`, {language: 'en-US'}, controller.signal);
        send(200, {id: String(id), name: text(result.name, 120), bio: text(result.biography, 8000) || 'No biography available.', source: mock ? 'tmdb-mock' : 'tmdb'});
      }
    } catch (error) {
      // Never expose fetch URLs, upstream bodies, raw exception messages or credentials.
      const safe = /^(TMDB request failed \(HTTP \d{3}\)\.|TMDB credentials are not configured on the server\.)$/.test(error.message) ? error.message : 'TMDB proxy request failed. Retry shortly.';
      send(502, {error: safe});
    } finally { clearTimeout(timeout); active -= 1; }
  });
}
async function start() {
  const live = process.argv.includes('--live');
  let apiKey = '';
  if (live) {
    if (!process.argv.includes('--allow-tmdb-key-use')) { throw new Error('Live mode requires explicit --allow-tmdb-key-use after owner approval.'); }
    const content = await readFile(path.resolve(__dirname, '../.env'), 'utf8');
    const line = content.split(/\r?\n/).find(value => /^\s*MOVIE_DATABASE_API_KEY\s*=/.test(value));
    apiKey = line?.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2') || '';
    if (!apiKey || apiKey.startsWith('YOUR_') || apiKey.length > 512) { throw new Error('A valid server-side TMDB v3 key is required.'); }
  }
  const server = createProxy({mock: !live, apiKey});
  server.listen(8787, '127.0.0.1', () => console.info(`Itar TMDB proxy: ${live ? 'live' : 'mock responses (no credentials)'} on 127.0.0.1:8787`));
  server.on('error', () => { console.error('Local proxy could not bind 127.0.0.1:8787.'); process.exitCode = 1; });
}
if (require.main === module) { start().catch(() => { console.error('Local TMDB proxy could not start; check server-only setup. No credentials were logged.'); process.exitCode = 1; }); }
module.exports = {createProxy, mapFilm};
