import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import { readRepository } from '#cli/repository/tree.ts';

describe('tags', () => {
    test('tags come from extension, filename, shebang and content', async () => {
        await using sandbox = await createSandbox({
            hook: '#!/usr/bin/env bash\necho hi\n',
            'a.png': Buffer.from([0x89, 0x50, 0, 0]).toString('binary'),
            Dockerfile: 'FROM x\n',
            'binary.js': 'text\0binary',
        });
        chmodSync(join(sandbox.path, 'hook'), 0o755);
        const repository = await readRepository(sandbox.path, [], []);
        const files = new Map(repository.files.map((file) => [file.path, file]));
        const hook = files.get('hook')!;
        if (process.platform !== 'win32') expect(hook.tags).toContain('executable');
        for (const tag of ['shell', 'shebang:shell', 'text']) expect(hook.tags).toContain(tag);
        expect(files.get('a.png')!.nature).toBe('binary');
        expect(files.get('binary.js')!.nature).toBe('binary');
        expect(files.get('Dockerfile')!.tags).toContain('dockerfile');
    });
});
