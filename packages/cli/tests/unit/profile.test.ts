import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { readProfile } from '#cli/profile/read.ts';

describe('profile file paths', () => {
    test('an absolute profile loads from a different working directory', async () => {
        const source = 'policies/café house.profile.toml';
        await using fixture = await createFixture({
            [source]: 'version = 1\nprofile = "house"\nselection = "exact"\npresets = ["bash"]\n',
            'project/README.md': '# Project\n',
        });
        const relative = await readProfile(source, fixture.path);
        const absolute = await readProfile(join(fixture.path, source), join(fixture.path, 'project'));
        expect(absolute.tables).toEqual(relative.tables);
        expect(absolute.digest).toBe(relative.digest);
    });
});
