import { join, sep } from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createFixture } from 'fs-fixture';
import { normalizePath } from '#plugin/files.ts';
import { describe, expect, test } from 'bun:test';

describe('plugin file paths', () => {
    test('a file URL resolves the original file through spaces, percent signs, and Unicode', async () => {
        const content = 'export const count = 1;\n';
        await using fixture = await createFixture({ 'source % café.ts': content });
        const path = join(fixture.path, 'source % café.ts');
        const normalized = normalizePath(pathToFileURL(path).href);
        expect(normalized).toBe(path.split(sep).join('/'));
        expect(readFileSync(normalized, 'utf8')).toBe(content);
    });
});
