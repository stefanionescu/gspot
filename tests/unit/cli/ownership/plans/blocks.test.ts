import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { applyBlock } from '#cli/system/managed-blocks.ts';
import { planBlock, planRemoval } from '#cli/ownership/plans.ts';
import { writePlans, openWriter } from '#cli/ownership/writer.ts';

{
    test('managed block updates and removal keep your text around the block', async () => {
        await using directory = await testdir();
        const original = '# Authored\r\n\r\nKeep these trailing lines.\r\n\r\n';
        await createFileTree(directory.path, { 'AGENTS.md': original });
        const prefix = 'Additional instructions.\n';
        const suffix = '\nLater authored instructions.\n';
        {
            using log = openWriter(directory.path);
            writePlans(log, [planBlock(log, 'AGENTS.md', 'first instructions', 'markdown')]);
            const installed = log.files.read('AGENTS.md')!.bytes.toString('utf8');
            expect(installed.startsWith(original)).toBe(true);
            await writeFile(join(directory.path, 'AGENTS.md'), prefix + installed + suffix);
            writePlans(log, [planBlock(log, 'AGENTS.md', 'updated instructions', 'markdown')]);
            expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(
                prefix +
                    applyBlock(original, 'updated instructions', { path: 'AGENTS.md', style: 'markdown' }) +
                    suffix,
            );
        }
        {
            using log = openWriter(directory.path);
            writePlans(log, [planRemoval(log, 'AGENTS.md')]);
            expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(prefix + original + suffix);
        }
    });

    test('removing the only block deletes the file', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'AGENTS.md': '' });
        {
            using log = openWriter(directory.path);

            writePlans(log, [planBlock(log, 'AGENTS.md', 'instructions', 'markdown')]);
            writePlans(log, [planRemoval(log, 'AGENTS.md')]);
            expect(log.files.read('AGENTS.md')).toBeUndefined();
        }
    });
}
