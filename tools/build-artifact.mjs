// Gera uma versão de prévia para publicar como Artifact no claude.ai (uso interno de desenvolvimento).
// Junta o JavaScript num arquivo só e embute o CSS, porque a prévia não carrega CSS/JS de arquivos próprios.
// Uso: node tools/build-artifact.mjs  →  dist/artifact/
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'dist/artifact');
mkdirSync(join(out, 'data'), { recursive: true });
mkdirSync(join(out, 'assets'), { recursive: true });

execFileSync('npx', ['--yes', 'esbuild@0.23.1', join(root, 'js/app.js'), '--bundle', '--format=iife', '--target=es2020', '--minify', '--outfile=' + join(out, 'bundle.js')], { stdio: 'inherit' });

const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'css/app.css'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script src="https://cdn.jsdelivr.net'));
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];
const bundle = readFileSync(join(out, 'bundle.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const page = `<title>FLOWCLASS Intelligence</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fonts}
<style>${css}</style>
<script>try { var t = localStorage.getItem('liceu.theme'); if (t && t !== 'sistema') document.documentElement.setAttribute('data-skin', t); } catch (e) {}</script>
${body}
<script>${bundle}</script>
`;
writeFileSync(join(out, 'index.html'), page);

// Termos e privacidade como páginas próprias, com CSS embutido.
const legalCss = readFileSync(join(root, 'css/legal.css'), 'utf8');
for (const f of ['termos.html', 'privacidade.html']) {
  const src = readFileSync(join(root, f), 'utf8')
    .replace('<link rel="stylesheet" href="css/app.css">', `<style>${css}</style>`)
    .replace('<link rel="stylesheet" href="css/legal.css">', `<style>${legalCss}</style>`)
    .replace(/href="index\.html"/g, 'href="./"');
  writeFileSync(join(out, f), src);
}
copyFileSync(join(root, 'data/seed.json'), join(out, 'data/seed.json'));
copyFileSync(join(root, 'assets/favicon.svg'), join(out, 'assets/favicon.svg'));
console.log('Prévia gerada em', out);
