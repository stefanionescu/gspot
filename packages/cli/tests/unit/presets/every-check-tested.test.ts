import { globby } from 'globby';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { allChecks } from '#cli/presets/listing.ts';

const root = fileURLToPath(new URL('../../../../..', import.meta.url));

describe('the shipped checks', () => {
    test('every shipped check has a test that names it', async () => {
        const files = await globby(['tests/**/*.test.ts', 'packages/*/tests/**/*.test.ts'], {
            cwd: root,
            absolute: true,
        });
        const own = fileURLToPath(new URL(import.meta.url));
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
