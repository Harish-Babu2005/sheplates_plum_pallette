import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../components/sheplates-v3.tsx', import.meta.url), 'utf8');
const entry = fs.readFileSync(new URL('../components/sheplates-entry.tsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const manifest = fs.readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('customer portal exposes the 2.0 navigation: top bar and menu row on the website, a floating pill on phones', () => {
  const shell = fs.readFileSync(new URL('../components/customer-v2/shell.tsx', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../app/shell-kit.css', import.meta.url), 'utf8');
  assert.match(app, /<CustomerBottomNav/);
  assert.match(app, /<CustomerHeader/);
  assert.match(app, /<CustomerFooter/);
  for (const tab of ['Marketplace', 'Food Drops', 'Stories', 'Maps', 'My schedule', 'Orders', 'My quotations']) assert.match(shell, new RegExp(`key: "${tab}"`));
  for (const tab of ['Marketplace', 'Maps', 'Stories', 'Orders', 'Profile']) assert.match(shell, new RegExp(`key: "${tab}", label`));
  assert.match(css, /\.k-pill, \.k-fab \{ display: none; \}/); // bottom pill is phones only
  assert.match(shell, /account-mobile/);
  assert.match(shell, /Open She Agent/);
  assert.match(shell, /Terms and Conditions/);
  assert.match(shell, /9600037836/);
});

test('staff navigation is a sidebar on the website and a menu with bottom tabs on phones', () => {
  const shell = fs.readFileSync(new URL('../components/staff/shell.tsx', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../app/staff-kit.css', import.meta.url), 'utf8');
  assert.match(app, /<StaffShell/);
  assert.match(shell, /Toggle navigation/);
  assert.match(shell, /k-scrim/);
  assert.match(shell, /Quick tabs/);
  assert.match(css, /\.k-nv\.on \{ background: #753b50/);
});

test('marketplace is explicitly designed for compact mobile product browsing', () => {
  assert.match(app, /sp-market-toolbar/);
  assert.match(app, /k-pr\b/);
  assert.match(app, /k-pr-img/);
  assert.match(app, /k-search-layout/);
  assert.match(app, /sp-ai-card/);
});

test('mobile UI includes safe areas and full-screen assistant behavior', () => {
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /sp-agent-panel/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /sp-mobile-bottom-nav/);
});

test('PWA metadata is prepared for standalone mobile installation', () => {
  assert.match(layout, /viewportFit: "cover"/);
  assert.match(layout, /appleWebApp/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(manifest, /"orientation": "portrait-primary"/);
  assert.match(manifest, /icon-maskable-512\.png/);
});

test('release inherits the v7 visual version', () => {
  assert.equal(pkg.version, '7.2.0');
});

test('public entry stays responsive for customer and vendor access', () => {
  assert.match(entry, /Vendor \/ Team/);
  assert.match(entry, />Sign in</);
  assert.match(entry, /e-tiles/);
});
