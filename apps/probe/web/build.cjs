/* eslint-env node, es2022 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const esbuild = require('esbuild');
const { defaultProxyURL } = require('../../../scripts/tmdb-endpoint.cjs');
const root = path.resolve(__dirname, '../../..');
const targets = ['browser', 'tizen', 'webos'];

// Original geometric app icon, generated at each platform's required test size.
function iconPng(size) {
  const chunk = (kind, data) => {
    const name = Buffer.from(kind);
    const result = Buffer.alloc(data.length + 12);

    result.writeUInt32BE(data.length);
    name.copy(result, 4);
    data.copy(result, 8);

    result.writeUInt32BE(
      zlib.crc32(Buffer.concat([name, data])),
      data.length + 8,
    );

    return result;
  };

  const header = Buffer.alloc(13);

  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 2;

  const pixels = Buffer.alloc((size * 3 + 1) * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const bar =
        y > size * 0.2 &&
        y < size * 0.8 &&
        ((x > size * 0.43 && x < size * 0.57) ||
          ((y < size * 0.32 || y > size * 0.68) &&
            x > size * 0.27 &&
            x < size * 0.73));

      const offset = y * (size * 3 + 1) + 1 + x * 3;

      pixels.set(bar ? [242, 248, 252] : [15, 30, 44], offset);
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function webPlugins(outdir) {
  return [
    {
      name: 'probe-web-boundaries',
      setup(build) {
        build.onResolve({ filter: /^react-native$/ }, () => ({
          path: path.join(__dirname, 'platform.ts'),
        }));

        build.onResolve({ filter: /^itar\/react$/ }, () => ({
          path: path.join(__dirname, 'focus.tsx'),
        }));

        build.onLoad({ filter: /\.(?:png|jpe?g|svg)$/ }, args => {
          const bytes = fs.readFileSync(args.path);

          const name =
            crypto
              .createHash('sha256')
              .update(bytes)
              .digest('hex')
              .slice(0, 16) + path.extname(args.path);

          fs.mkdirSync(path.join(outdir, 'assets'), { recursive: true });
          fs.writeFileSync(path.join(outdir, 'assets', name), bytes);

          return {
            loader: 'js',
            contents: `module.exports = {uri: ${JSON.stringify(
              `./assets/${name}`,
            )}};`,
          };
        });
      },
    },
  ];
}

function writeShell(target, outdir) {
  if (!targets.includes(target)) {
    throw new Error(`Unknown web target: ${target}`);
  }

  fs.copyFileSync(
    path.join(__dirname, 'index.html'),
    path.join(outdir, 'index.html'),
  );

  fs.writeFileSync(
    path.join(outdir, 'icon.png'),
    iconPng(target === 'tizen' ? 117 : 80),
  );

  if (target === 'tizen') {
    fs.writeFileSync(
      path.join(outdir, 'config.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" id="https://itar.dev/probe" version="1.0.0" viewmodes="maximized">
  <tizen:application id="ItarCinema.Probe" package="ItarCinema" required_version="6.5"/>
  <content src="index.html"/><name>Itar Cinema</name><icon src="icon.png"/>
  <feature name="http://tizen.org/feature/screen.size.all"/>
  <tizen:profile name="tv-samsung"/>
  <tizen:privilege name="http://tizen.org/privilege/internet"/>
  <access origin="https://kodi.mirror.garr.it" subdomains="false"/>
  <access origin="https://image.tmdb.org" subdomains="false"/>
  <access origin="https://epgtalk.com" subdomains="false"/>
  <tizen:setting screen-orientation="landscape" context-menu="disable" background-support="disable" encryption="disable" install-location="auto" hwkey-event="enable"/>
</widget>
`,
    );
  }

  if (target === 'webos') {
    fs.writeFileSync(
      path.join(outdir, 'appinfo.json'),
      JSON.stringify(
        {
          id: 'com.itar.probe',
          version: '1.0.0',
          vendor: 'Itar',
          type: 'web',
          main: 'index.html',
          title: 'Itar Cinema',
          icon: 'icon.png',
          resolution: '1920x1080',
          accessibility: { supportsAudioGuidance: true },
        },
        null,
        2,
      ) + '\n',
    );
  }
}

async function buildSite(target = 'browser') {
  if (!targets.includes(target)) {
    throw new Error(`Use one of: ${targets.join(', ')}`);
  }

  const engine = path.join(root, 'build/web-engine');

  for (const file of ['itar-web.js', 'itar-web.wasm']) {
    if (!fs.existsSync(path.join(engine, file))) {
      throw new Error(`Missing ${file}; build the web engine first.`);
    }
  }

  const outdir = path.join(root, 'build/probe-web', target);

  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(outdir, { recursive: true });

  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [path.join(__dirname, 'index.tsx')],
    outdir,
    entryNames: 'app',
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome85'],
    define: {
      __DEV__: 'false',
      'process.env.NODE_ENV': '"production"',
      'process.env.ITAR_TMDB_PROXY_URL': JSON.stringify(defaultProxyURL),
      'import.meta.url': '__itarModuleUrl',
    },
    banner: {
      js: 'var __itarModuleUrl = document.currentScript ? document.currentScript.src : document.baseURI;',
    },
    minify: true,
    metafile: true,
    legalComments: 'eof',
    plugins: webPlugins(outdir),
    resolveExtensions: [
      '.web.tsx',
      '.web.ts',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
    ],
    loader: { '.wasm': 'binary' },
    assetNames: 'assets/[name]-[hash]',
  });

  // Keep the standalone artifact for inspection; the app embeds wasmBinary for local TV URLs.
  fs.copyFileSync(
    path.join(engine, 'itar-web.wasm'),
    path.join(outdir, 'itar-web.wasm'),
  );

  writeShell(target, outdir);

  fs.writeFileSync(
    path.join(outdir, 'build-manifest.json'),
    JSON.stringify(
      {
        target,
        engine: 'C++20/Wasm',
        javascriptTarget: 'chrome85',
        deviceAcceptance: 'NOT RUN',
        inputs: Object.keys(result.metafile.inputs).sort(),
      },
      null,
      2,
    ) + '\n',
  );

  console.info(
    `Built ${target}: ${path.relative(root, outdir)}${
      target === 'browser' ? '' : ' (unsigned staging directory)'
    }`,
  );

  return outdir;
}

module.exports = { buildSite, webPlugins, writeShell };

if (require.main === module) {
  buildSite(process.argv[2]).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
