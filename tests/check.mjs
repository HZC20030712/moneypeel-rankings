#!/usr/bin/env node
/**
 * Consistency checks for the generated dataset.
 *
 * These are cheap guards against the two ways this repository rots:
 *   1. the generator writes a table that disagrees with the CSV;
 *   2. someone hand-edits a row and the snapshot stops matching its own badge.
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
const zh = read('README.zh.md');
const csv = read('data/startups.csv');

// 1. Every row links to the site with a UTM tag, so attribution is measurable.
const links = [...en.matchAll(/]\((https:\/\/moneypeel\.com\/[^)]+)\)/g)].map((m) => m[1]);
check(
  'README links carry the campaign tag',
  links.length > 0 && links.every((u) => u.includes('utm_campaign=moneypeel-rankings')),
  links.length + ' links'
);

// 2. Both languages present and equally sized.
check('zh README exists', zh.includes('CC BY 4.0'));
check(
  'both tables have the same row count',
  (en.match(/^\| \d+ \|/gm) ?? []).length === (zh.match(/^\| \d+ \|/gm) ?? []).length,
  (en.match(/^\| \d+ \|/gm) ?? []).length + ' rows'
);

// 3. CSV and README describe the same snapshot.
const csvRows = csv.trim().split('\n').length - 1;
const badge = en.match(/products-(\d+)-1f2937/);
check(
  'badge count matches CSV',
  badge && Number(badge[1]) === csvRows,
  'badge=' + (badge?.[1] ?? '?') + ' csv=' + csvRows
);

// 4. The licence and the coverage date are stated.
check('licence stated', /CC BY 4\.0/.test(en) && /CC BY 4\.0/.test(read('LICENSE')));
check('coverage date stated', /data as of \d{4}-\d{2}-\d{2}/i.test(en));

// 5. No point values may leak: a band is an inequality or a range, never a figure.
const suspicious = [...csv.matchAll(/,(\d{4,})(?=\D|$)/g)].map((m) => m[1]);
check(
  'no exact revenue figure in the CSV',
  suspicious.length === 0,
  suspicious.slice(0, 3).join(',')
);

// 6. Every category file linked from the README exists.
const linked = [...en.matchAll(/categories\/([a-z0-9-]+)\.md/g)].map((m) => m[1]);
const present = new Set(readdirSync(join(ROOT, 'categories')).map((f) => f.replace(/\.md$/, '')));
const missing = [...new Set(linked)].filter((slug) => !present.has(slug));
check('every linked category file exists', missing.length === 0, missing.join(',') || 'ok');

// 7. Cross-link to the MCP repository, and back to the site.
check('links to the MCP repository', en.includes('github.com/moneypeel/moneypeel-mcp'));
check('links to the site root', en.includes('https://moneypeel.com'));

console.log('');
console.log(failures.length === 0 ? 'all ' + checks.length + ' checks passed' : failures.length + ' check(s) failed');
process.exit(failures.length === 0 ? 0 : 1);
