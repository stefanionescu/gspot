import { readFileSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { testToolsText } from '#cli/generation/tools/mise.ts';

const TRACKED = fileURLToPath(new URL('../../../.mise/conf.d/test-tools.toml', import.meta.url));

test('the tracked test tool pins are what the manifests render', () => {
    expect(readFileSync(TRACKED, 'utf8')).toBe(testToolsText());
});
