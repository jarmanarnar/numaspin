import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('narrow header retains standard currency tab typography and icon dimensions', async () => {
  const css = await readFile(new URL('../public/wallet-header.css', import.meta.url), 'utf8');
  const narrow = css.slice(css.indexOf('@media (width < 24rem)'), css.indexOf('@media (width < 19rem)'));
  assert.doesNotMatch(narrow, /wallet-currency-(?:tab|selector)/);
  assert.match(css, /\.wallet-currency-tab \{\s*box-sizing: border-box;\s*flex: none;/);
  assert.match(narrow, /grid-template-columns: minmax\(2rem, 1fr\) auto minmax\(3rem, 1fr\)/);
});