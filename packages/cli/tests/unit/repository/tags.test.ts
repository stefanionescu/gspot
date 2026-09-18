import { createFixture } from 'fs-fixture';
import { describe, expect, test } from 'bun:test';
import { tagEntry } from '#cli/repository/tags.ts';

describe('tags', () => {
    test('tags come from extension, filename, shebang and content', async () => {
        await using fixture = await createFixture({
            hook: '#!/usr/bin/env bash\necho hi\n',
            'a.png': Buffer.from([0x89, 0x50, 0, 0]).toString('binary'),
            Dockerfile: 'FROM x\n',
        });
        const hook = tagEntry(fixture.path, { path: 'hook', size: 20, executable: true, symlink: false });
        for (const tag of ['shell', 'executable', 'shebang:shell', 'text']) expect(hook.tags).toContain(tag);
        expect(tagEntry(fixture.path, { path: 'a.png', size: 4, executable: false, symlink: false }).binary).toBe(true);
        expect(
            tagEntry(fixture.path, { path: 'Dockerfile', size: 7, executable: false, symlink: false }).tags,
        ).toContain('dockerfile');
    });
});
