import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { readProfile } from '#cli/profile/read.ts';

describe('profile file paths', () => {
    test('an absolute profile loads from a different working directory', async () => {
        const source = 'policies/café house.profile.toml';
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            [source]: 'version = 1\nprofile = "house"\nselection = "exact"\npresets = ["bash"]\n',
            'project/README.md': '# Project\n',
        });
        const relative = await readProfile(source, sandbox.path);
        const absolute = await readProfile(join(sandbox.path, source), join(sandbox.path, 'project'));
        expect(absolute.tables).toEqual(relative.tables);
        expect(absolute.digest).toBe(relative.digest);
    });
});
