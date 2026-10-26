// Checagem rápida antes de subir: sintaxe de todos os módulos e JSON do seed.
import { readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const files = [];
const walk = (d) => readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.m?js$/.test(e.name)) files.push(p); });
walk(join(root, 'js'));
walk(join(root, 'tools'));
let fail = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { fail++; console.error('✗', f, '\n', String(e.stderr)); }
}
try { JSON.parse(readFileSync(join(root, 'data/seed.json'), 'utf8')); } catch (e) { fail++; console.error('✗ data/seed.json', e.message); }
console.log(fail ? `${fail} problema(s)` : `ok: ${files.length} arquivos`);
process.exit(fail ? 1 : 0);
