import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../components/sheplates-v3.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('v7.1 is the adaptive glass visual release', () => {
  assert.equal(pkg.version, '7.2.0');
  assert.match(css, /ShePlates v7\.1 — adaptive Apple-like glass layer/);
});

test('She Agent uses a modern orbital visual mark without changing agent flow', () => {
  assert.match(app, /<Activity className=\"size-5\" \/>/);
  assert.match(app, /sp-agent-orb/);
  assert.doesNotMatch(app, /Ask naturally · grounded in your marketplace/);
  assert.doesNotMatch(app, /Ask your commerce copilot/);
  assert.match(app, /<SheAgent open=\{agentOpen\}/);
  assert.match(css, /sp-agent-launcher/);
  assert.match(css, /sp-agent-logo-bounce/);
  assert.match(css, /\.sp-agent-launcher:hover\s*\{[^}]*linear-gradient/s);
  assert.match(css, /\.sp-staff-agent-launcher:hover\s*\{[^}]*rgba\(35,122,69/s);
  assert.match(css, /sp-agent-panel/);
});

test('glass is applied to popup materials and floating mobile navigation', () => {
  assert.match(css, /\[data-slot="dialog-content"\]/);
  assert.match(css, /\[data-slot="sheet-content"\]/);
  assert.match(css, /backdrop-filter: blur\(30px\) saturate\(185%\)/);
  assert.match(css, /sp-mobile-bottom-nav/);
});

test('mobile She Agent remains viewport-safe and floating', () => {
  assert.match(css, /height: min\(88dvh, 820px\)/);
  assert.match(css, /max-height: calc\(100dvh/);
  assert.match(css, /border-radius: 32px/);
});
