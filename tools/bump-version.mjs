// Usage: node tools/bump-version.mjs [major|minor|patch]   (default: patch)
// Bumps VERSION in sw.js so installed copies of the game auto-update.
import { readFileSync, writeFileSync } from 'node:fs';
const file = new URL('../sw.js', import.meta.url);
const src = readFileSync(file, 'utf8');
const m = src.match(/const VERSION = '(\d+)\.(\d+)\.(\d+)'/);
if (!m) { console.error('VERSION not found in sw.js'); process.exit(1); }
let [maj, min, pat] = m.slice(1).map(Number);
const kind = process.argv[2] || 'patch';
if (kind === 'major') { maj++; min = 0; pat = 0; } else if (kind === 'minor') { min++; pat = 0; } else pat++;
const v = `${maj}.${min}.${pat}`;
writeFileSync(file, src.replace(m[0], `const VERSION = '${v}'`));
console.log(`sw.js VERSION -> ${v}`);
