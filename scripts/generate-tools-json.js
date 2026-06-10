#!/usr/bin/env node
// Scans the tools/ folder and writes tools.json so the homepage can load
// the catalog without hitting the rate-limited GitHub API at page load.
// Run from the repo root: node scripts/generate-tools-json.js

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const toolsDir = path.join(repoRoot, 'tools');
const outFile = path.join(repoRoot, 'tools.json');

const entries = fs.readdirSync(toolsDir, { withFileTypes: true })
  .filter(e => (e.isDirectory() || e.name.endsWith('.html')) && !e.name.startsWith('.'))
  .map(e => ({
    name: e.name,
    type: e.isDirectory() ? 'dir' : 'file',
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const output = {
  generated: new Date().toISOString(),
  tools: entries,
};

fs.writeFileSync(outFile, JSON.stringify(output, null, 2) + '\n');
console.log(`Wrote ${entries.length} tools to tools.json`);
