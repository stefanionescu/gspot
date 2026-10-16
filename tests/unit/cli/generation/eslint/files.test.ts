import picomatch from 'picomatch';
import { test, expect } from 'bun:test';
import { buildFilePatterns } from '#cli/generation/eslint/files.ts';

test('Node file patterns match a filename with a backslash and not its neighbor', () => {
    const file = String.raw`scripts/run\name`;
    const patterns = buildFilePatterns({ components: [], tests: [], scripts: [], nodeFiles: [file] }).code;
    const matches = picomatch(patterns, { dot: true, windows: false });
    expect(matches(file)).toBe(true);
    expect(matches('scripts/runname')).toBe(false);
});
