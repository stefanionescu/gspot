import { join, sep } from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createSandbox } from '@gspot/testing';
import { normalizePath } from '#plugin/files.ts';
import { describe, expect, test } from 'bun:test';

describe('plugin file paths', () => {
    test('a file URL resolves the original file through spaces, percent signs, and Unicode', async () => {
        const content = 'export const count = 1;\n';
        await using sandbox = await createSandbox({ 'source % café.ts': content });
        const path = join(sandbox.path, 'source % café.ts');
        const normalized = normalizePath(pathToFileURL(path).href);
        expect(normalized).toBe(path.split(sep).join('/'));
        expect(readFileSync(normalized, 'utf8')).toBe(content);
    });
});
