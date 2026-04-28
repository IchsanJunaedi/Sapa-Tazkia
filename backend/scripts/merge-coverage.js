#!/usr/bin/env node
/* eslint-disable no-console */
//
// scripts/merge-coverage.js
//
// Merges two lcov reports into a single `coverage/lcov.info` file that can be
// uploaded to Codecov:
//
//   - coverage/jest/lcov.info   ← produced by Jest (`npm run test:coverage`)
//   - coverage/e2e/lcov.info    ← produced by Playwright via MCR
//
// Backend and frontend source files rarely overlap, so a plain concatenation
// is sufficient and preserves both reports in full. If they ever do overlap,
// swap this script for `npx lcov-result-merger 'coverage/*/lcov.info' coverage/lcov.info`
// which deduplicates and sums line counts.
//
// Usage:
//   node scripts/merge-coverage.js
//   # or via npm:
//   npm run coverage:merge

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'coverage');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'lcov.info');

const sources = [
  { label: 'Jest (backend)', file: path.join(ROOT, 'coverage', 'jest', 'lcov.info') },
  { label: 'Playwright (e2e)', file: path.join(ROOT, 'coverage', 'e2e', 'lcov.info') },
];

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const chunks = [];
for (const src of sources) {
  if (fs.existsSync(src.file)) {
    const content = fs.readFileSync(src.file, 'utf8').trim();
    if (content.length) {
      chunks.push(content);
      console.log(`✓ Included ${src.label}: ${path.relative(ROOT, src.file)}`);
    } else {
      console.warn(`⚠ Empty report, skipped: ${src.label}`);
    }
  } else {
    console.warn(`⚠ Not found, skipped: ${src.label} (${path.relative(ROOT, src.file)})`);
  }
}

if (chunks.length === 0) {
  console.error('No coverage files to merge. Run `npm run test:coverage` and/or `npm run test:e2e` first.');
  process.exit(1);
}

fs.writeFileSync(OUTPUT_FILE, chunks.join('\n') + '\n', 'utf8');

console.log(`→ Wrote merged report to ${path.relative(ROOT, OUTPUT_FILE)}`);
console.log('  Upload to Codecov with: bash <(curl -s https://codecov.io/bash) -f coverage/lcov.info');
