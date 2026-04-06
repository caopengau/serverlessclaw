#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const covPath = path.join(process.cwd(), 'coverage', 'coverage-final.json');
if (!fs.existsSync(covPath)) {
  console.error('coverage-final.json not found at', covPath);
  process.exit(2);
}
const raw = fs.readFileSync(covPath, 'utf8');
let json;
try {
  json = JSON.parse(raw);
} catch (e) {
  console.error('invalid JSON', e);
  process.exit(2);
}
const rows = [];
for (const [filePath, metrics] of Object.entries(json)) {
  const rel = filePath.replace(process.cwd() + '/', '');
  if (!rel.startsWith('core/')) continue; // only core
  const s = metrics.s || {};
  const total = Object.keys(s).length;
  const covered = Object.values(s).filter((v) => v > 0).length;
  const percent = total === 0 ? null : (covered / total) * 100;
  rows.push({ file: rel, total, covered, percent });
}
rows.sort((a, b) => {
  if (a.percent === null && b.percent === null) return 0;
  if (a.percent === null) return 1;
  if (b.percent === null) return -1;
  return a.percent - b.percent;
});
console.log('percent\tcovered/total\tfile');
for (const r of rows) {
  const pct = r.percent === null ? 'n/a' : r.percent.toFixed(1) + '%';
  console.log(`${pct}\t${r.covered}/${r.total}\t${r.file}`);
}
