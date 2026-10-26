// Stage only source inputs. Never publish or include build outputs/caches.
const {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} = require('node:fs');
const path = require('node:path');
const pkg = path.resolve(__dirname, '..');
const root = path.resolve(pkg, '../..');
const cpp = path.join(pkg, 'cpp');
rmSync(cpp, {recursive: true, force: true});
mkdirSync(cpp);
for (const name of ['include', 'src']) {
  cpSync(path.join(root, 'core', name), path.join(cpp, name), {recursive: true});
}
const coreBuild = readFileSync(path.join(root, 'core/CMakeLists.txt'), 'utf8');
writeFileSync(path.join(cpp, 'CMakeLists.txt'), coreBuild.split('# C-compatible production boundary')[0]);
cpSync(path.join(root, 'LICENSE'), path.join(pkg, 'LICENSE'));
