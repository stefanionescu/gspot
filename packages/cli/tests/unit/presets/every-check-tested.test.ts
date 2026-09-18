import { globby } from 'globby';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { allChecks } from '#cli/presets/listing.ts';

const root = new URL('../../../../..', import.meta.url).pathname;

describe('the shipped checks', () => {
    test('every shipped check has a test that names it', async () => {
        const files = await globby(['tests/**/*.test.ts', 'packages/*/tests/**/*.test.ts'], {
            cwd: root,
            absolute: true,
        });
        const own = new URL(import.meta.url).pathname;
        const text = files
            .filter((file) => file !== own)
            .map((file) => readFileSync(file, 'utf8'))
            .join('\n');
        const untested = allChecks()
            .keys()
            .filter((id) => !text.includes(`'${id}'`))
            .toArray();
        expect(untested).toEqual([]);
    });
});
