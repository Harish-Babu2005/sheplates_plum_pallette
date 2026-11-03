import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../components/sheplates-v3.tsx', import.meta.url), 'utf8');
const entry = fs.readFileSync(new URL('../components/sheplates-entry.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('v7 is a visual-only modern UI release', () => {
  assert.equal(pkg.version, '7.2.0');
  assert.match(app, /sp-v7/);
  assert.match(entry, /sp-entry/);
  assert.match(css, /ShePlates v7 — modern hyperlocal commerce visual system/);
});

test('customer marketplace has modern semantic styling hooks', () => {
  for (const hook of ['sp-marketplace','sp-market-toolbar']) {
    assert.match(app, new RegExp(hook));
    assert.match(css, new RegExp(hook));
  }
  // The category strip and floating bottom bar were replaced by the redesigned grid and tab bar.
  assert.match(app, /<CategoryGrid/);
  assert.match(css, /sp-mobile-bottom-nav/);
});

test('staff, modal, agent and onboarding surfaces share the v7 design system', () => {
  for (const hook of ['sp-page-heading','sp-metric-card','sp-empty-state','sp-agent-launcher']) {
    assert.match(app, new RegExp(hook));
    assert.match(css, new RegExp(hook));
  }
  assert.match(entry, /sp-auth-hero/);
  assert.match(entry, /sp-agent-preview/);
});

test('mobile interaction rules retain accessible tap targets and modal priority', () => {
  assert.match(css, /min-height: 44px/);
  assert.match(css, /sp-mobile-bottom-nav[\s\S]*background: rgba\(255,255,255,.97\)/);
  assert.match(css, /\[data-slot="dialog-overlay"\]/);
  assert.match(css, /100dvh/);
});
