import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { chmod } from 'node:fs/promises';
import { tagEntry } from '#cli/repository/tags.ts';
import { testdir, createFileTree } from 'testdirs';
import { readRepository } from '#cli/repository/read.ts';
import { SHEBANG_CASES } from '#tests/config/cli/repository/tags.ts';

test('tags come from extension, filename, shebang and content', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        hook: '#!/usr/bin/env bash\necho hi\n',
        'a.png': Buffer.from([0x89, 0x50, 0, 0]).toString('binary'),
        Dockerfile: 'FROM x\n',
        'binary.js': 'text\0binary',
    });
    await chmod(join(sandbox.path, 'hook'), 0o755);
    const repository = await readRepository(sandbox.path, [], [], []);
    const files = new Map(repository.files.map((file) => [file.path, file]));
    const hook = files.get('hook')!;
    // The shell shebang grants the executable tag, so the bit itself is not needed.
    expect(hook.tags).toContain('executable');
    for (const tag of ['shell', 'shebang:shell', 'text']) expect(hook.tags).toContain(tag);
    expect(files.get('a.png')!.kind).toBe('binary');
    expect(files.get('binary.js')!.kind).toBe('binary');
    expect(files.get('Dockerfile')!.tags).toContain('dockerfile');
});

test.each(SHEBANG_CASES)('$name source receives only its applicable language and runtime tags', ({ source, tags }) => {
    const prefix = Buffer.from(source);
    const result = tagEntry({ path: 'script', size: prefix.length, executable: false, symlink: false }, prefix);
    expect(result.binary).toBe(false);
    expect(new Set(result.tags)).toStrictEqual(new Set(tags));
});

test('binary content receives no shebang language or runtime tags', () => {
    const prefix = Buffer.from('#!/usr/bin/env bun\n\0');
    expect(tagEntry({ path: 'script', size: prefix.length, executable: true, symlink: false }, prefix)).toStrictEqual({
        binary: true,
        tags: ['binary', 'executable'],
    });
});

test.each(['sh', 'dash'])('%s overrides the Bash extension tag of a shell script', (interpreter) => {
    const prefix = Buffer.from(`#!/bin/${interpreter}\nprintf "%s\\n" example\n`);
    const result = tagEntry({ path: 'script.sh', size: prefix.length, executable: false, symlink: false }, prefix);
    expect(result.tags).toContain('sh');
    expect(result.tags).not.toContain('bash');
});
