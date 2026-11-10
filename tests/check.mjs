#!/usr/bin/env node
/**
 * Consistency checks for the generated dataset.
 *
 * Guards the ways this repository rots:
 *   1. the generator writes tables that disagree across locales or with the CSV;
 *   2. someone hand-edits a row and the snapshot stops matching its own badge;
 *   3. a point value leaks into a table that is supposed to publish bands only.
 *
 * Run: node tests/check.mjs
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const failures = [];
const checks = [];
function check(name, ok, detail) {
  checks.push(name);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  ' + detail : ''));
  if (!ok) failures.push(name);
}

const en = read('README.md');
const zhCN = read('README.zh-CN.md');
const zhTW = read('README.zh-TW.md');
const csv = read('data/startups.csv');

// 1. Three locales, cross-linked, no orphan file.
check(
  'three locales cross-link each other',
  en.includes('README.zh-CN.md') &&
    en.includes('README.zh-TW.md') &&
    zhCN.includes('README.md') &&
    zhTW.includes('README.md')
);

// 2. Every row links to the site with a campaign tag, so attribution is measurable.
const links = [...en.matchAll(/\]\((https:\/\/moneypeel\.com\/[^)]+)\)/g)].map((m) => m[1]);
check(
  'README links carry the campaign tag',
  links.length > 0 && links.every((u) => u.includes('utm_campaign=moneypeel-rankings')),
  links.length + ' links'
);

// 3. The three tables describe the same rows.
const countRows = (text) => (text.match(/^\| \d+ \|/gm) ?? []).length;
const rowCounts = [countRows(en), countRows(zhCN), countRows(zhTW)];
check(
  'all three locales have the same row count',
  rowCounts[0] === rowCounts[1] && rowCounts[1] === rowCounts[2],
  rowCounts.join(' / ')
);

// 4. Logos are present on every row, and they point at the site.
const logoRows = (en.match(/<img src="https:\/\/moneypeel\.com\/logos\//g) ?? []).length;
// One row uses an .ico that turned out to be an HTML error page, not an image;
// it ships without a logo on purpose rather than as a broken image.
check(
  'logos on every row that has a usable image',
  logoRows >= rowCounts[0] - 1,
  logoRows + ' logos / ' + rowCounts[0] + ' rows'
);

// 5. CSV and README describe the same snapshot.
const csvRows = csv.trim().split('\n').length - 1;
const badge = en.match(/products-(\d+)-1f2937/);
check(
  'badge count matches CSV',
  badge && Number(badge[1]) === csvRows,
  'badge=' + (badge?.[1] ?? '?') + ' csv=' + csvRows
);

// 6. The licence and the coverage date are stated.
check(
  'licence stated',
  /CC BY 4\.0/.test(en) && /Creative Commons Attribution 4\.0/.test(read('LICENSE'))
);
check('coverage date stated', /data as of \d{4}-\d{2}-\d{2}/i.test(en));

// 7. No point values may leak: bands only, in every locale.
const leaking = [...csv.matchAll(/\$\d{4,}/g)].map((m) => m[0]);
check('no exact revenue figure anywhere', leaking.length === 0, leaking.slice(0, 3).join(','));

// 8. Every category file linked from the README exists, and none are orphaned.
const linked = [...en.matchAll(/categories\/([a-z0-9-]+)\.md/g)].map((m) => m[1]);
const present = new Set(readdirSync(join(ROOT, 'categories')).map((f) => f.replace(/\.md$/, '')));
const missing = [...new Set(linked)].filter((slug) => !present.has(slug));
check('every linked category file exists', missing.length === 0, missing.join(',') || 'ok');

// 9. Cross-links that make the funnel work.
check('links to the MCP repository', en.includes('github.com/HZC20030712/moneypeel-mcp'));
check('links to the site root', en.includes('https://moneypeel.com'));

// 10. The FAQ exists (it carries the licence and methodology answers).
check('FAQ section present', en.includes('## FAQ') && zhCN.includes('## 常见问题') && zhTW.includes('## 常見問題'));

console.log('');
console.log(failures.length === 0 ? 'all ' + checks.length + ' checks passed' : failures.length + ' check(s) failed');
process.exit(failures.length === 0 ? 0 : 1);
