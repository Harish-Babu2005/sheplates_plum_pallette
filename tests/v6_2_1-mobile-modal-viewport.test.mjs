import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const dialog = fs.readFileSync(new URL('../components/ui/dialog.tsx', import.meta.url), 'utf8');
const sheet = fs.readFileSync(new URL('../components/ui/sheet.tsx', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('mobile dialogs are viewport anchored and no longer use translated centering', () => {
  assert.match(css, /\[data-slot="dialog-content"\][\s\S]*?inset: auto 0 0 0 !important/);
  assert.match(css, /width: auto !important/);
  assert.match(css, /max-height: calc\(100dvh/);
  assert.match(css, /transform: none !important/);
});

test('modal layers stay above the mobile bottom navigation', () => {
  assert.match(dialog, /z-\[90\]/);
  assert.match(dialog, /z-\[91\]/);
  assert.match(sheet, /z-\[90\]/);
  assert.match(sheet, /z-\[91\]/);
  assert.match(css, /\.sp-mobile-bottom-nav[\s\S]*?z-index: 58/);
});

test('auth dialog remains keyboard friendly without percentage width math', () => {
  assert.match(css, /\[data-slot="dialog-content"\]\.sp-auth-dialog[\s\S]*?left: 8px !important[\s\S]*?right: 8px !important[\s\S]*?width: auto !important/);
});

test('release inherits the v7 visual version', () => {
  assert.equal(pkg.version, '7.2.0');
});
