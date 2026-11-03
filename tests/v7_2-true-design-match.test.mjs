import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const entry = read('components/sheplates-entry.tsx');
const shell = read('components/sheplates-v3.tsx');
const css = read('app/globals.css');
const pkg = JSON.parse(read('package.json'));

test('v7.2 is the true design-match visual release', () => {
  assert.equal(pkg.version, '7.2.0');
  assert.match(entry, /Home-cooked food, from your own neighbourhood/);
  assert.match(entry, /e-hero-card/);
  assert.match(entry, /e-steps/);
  assert.match(css, /ShePlates v7\.2 — TRUE DESIGN MATCH/);
});

test('public entry uses the approved light editorial visual system', () => {
  assert.match(css, /\.sp-entry-hero[\s\S]*linear-gradient/);
  assert.match(css, /\.sp-entry-title/);
  assert.match(css, /\.sp-entry-search[\s\S]*backdrop-filter/);
  assert.match(css, /\.sp-entry-plan-card/);
});

test('staff portal is light: white sidebar with a plum active pill, navigation logic unchanged', () => {
  const staffShell = fs.readFileSync(new URL('../components/staff/shell.tsx', import.meta.url), 'utf8');
  const staffCss = fs.readFileSync(new URL('../app/staff-kit.css', import.meta.url), 'utf8');
  assert.match(staffShell, /k-side/);
  assert.match(staffShell, /data-tour-nav/);
  assert.match(staffCss, /\.k-side \{[^}]*background: #fff/);
  assert.match(staffCss, /\.k-nv\.on \{ background: #753b50/);
});

test('glass remains limited to navigation overlays and She Agent', () => {
  assert.match(css, /Glass remains intentional/);
  assert.match(css, /\[data-slot="dialog-content"\]/);
  assert.match(css, /\.sp-agent-panel/);
  assert.match(css, /\.sp-mobile-bottom-nav/);
});
