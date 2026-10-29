import { build } from 'vite';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Empacota a própria aplicação, mantendo uma única implementação dos fluxos.
const root = process.cwd(),
  out = path.join(root, 'dist-standalone');
await build({
  base: './',
  build: {
    outDir: out,
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const dataUri = async (file, type) =>
  `data:${type};base64,${(await readFile(file)).toString('base64')}`;
const assets = new Map();
for (const [dir, type] of [
  ['brand', 'image/svg+xml'],
  ['fonts', 'font/woff2'],
]) {
  for (const name of await readdir(path.join(root, 'public', dir))) {
    if (
      (dir === 'brand' && !name.endsWith('.svg')) ||
      (dir === 'fonts' && !name.endsWith('.woff2'))
    )
      continue;
    assets.set(`${dir}/${name}`, await dataUri(path.join(root, 'public', dir, name), type));
  }
}
function embed(text) {
  for (const [key, value] of assets)
    text = text.replaceAll('./' + key, value).replaceAll('/' + key, value);
  return text;
}
let guide = await readFile(path.join(root, 'public/brand/guia.html'), 'utf8');
for (const [key, value] of assets) {
  const relative = key.startsWith('brand/') ? key.slice(6) : '../' + key;
  guide = guide.replaceAll(relative, value);
}
let html = await readFile(path.join(out, 'index.html'), 'utf8');
const licenses = {};
for (const name of await readdir(path.join(root, 'public/licenses'))) {
  licenses[name] = await readFile(path.join(root, 'public/licenses', name), 'utf8');
}
for (const name of ['react', 'react-dom', 'react-router-dom', 'react-router', 'lucide-react']) {
  const dir = path.join(root, 'node_modules', name);
  try {
    const license = (await readdir(dir)).find((file) => /^licen[sc]e(?:\.|$)/i.test(file));
    if (license) licenses[name] = await readFile(path.join(dir, license), 'utf8');
  } catch {
    /* Dependencies without a root alias retain their notices in the bundle. */
  }
}
html = html.replace(
  '</head>',
  () =>
    '<script type="application/json" id="cuidelo-licenses">' +
    JSON.stringify(licenses).replaceAll('<', '\\u003c') +
    '</script></head>',
);
const entries = (await readdir(path.join(out, 'assets'))).filter((x) => x.endsWith('.js'));
if (entries.length !== 1)
  throw new Error('A exportação precisa conter um único módulo JavaScript.');
let script = embed(await readFile(path.join(out, 'assets', entries[0]), 'utf8'));
script = script.replace(/(["'\x60])\/brand\/guia\.html\1/g, 'window.__CUIDELO_GUIDE_URL__');
if (script.includes('/brand/guia.html')) throw new Error('O guia ainda não foi incorporado.');
if (/(?:from\s*|import\s*\()(["'])\.\.?\//.test(script))
  throw new Error('Há dependência JavaScript externa no HTML.');
const styles = (await readdir(path.join(out, 'assets'))).filter((x) => x.endsWith('.css'));
let css = embed(
  (await Promise.all(styles.map((x) => readFile(path.join(out, 'assets', x), 'utf8')))).join('\n'),
);
const guideBoot = `<script>window.__CUIDELO_GUIDE_URL__=URL.createObjectURL(new Blob([${JSON.stringify(guide).replaceAll('<', '\\u003c')}],{type:'text/html;charset=utf-8'}));</script>`;
html = html.replace(
  /<script\b[^>]*src="[^"]+"[^>]*><\/script>/g,
  () =>
    guideBoot +
    '<script type="module">' +
    script.replace(/<\/script/gi, '<\\/script') +
    '</script>',
);
html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, () => '<style>' + css + '</style>');
html = embed(html);
if (/(?:src|href)=["'](?:\.\/)?assets\//.test(html))
  throw new Error('A exportação ainda aponta para arquivos externos.');
await writeFile(path.join(out, 'Cuidelo.html'), html, 'utf8');
const tv = html.replace(
  '<head>',
  '<head><script>if(!location.hash)location.hash="/painel?rede=aurora&unidade=aurora-centro&previa=1";</script>',
);
await writeFile(path.join(out, 'Cuidelo-TV.html'), tv, 'utf8');
const kiosk = html.replace(
  '<head>',
  '<head><script>if(!location.hash)location.hash="/totem?rede=aurora&unidade=aurora-centro";</script>',
);
await writeFile(path.join(out, 'Cuidelo-Totem.html'), kiosk, 'utf8');
console.log(
  `HTMLs independentes gerados: Cuidelo.html, Cuidelo-TV.html e Cuidelo-Totem.html (${Math.round(Buffer.byteLength(html) / 1024)} KB cada).`,
);
