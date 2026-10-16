import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { applyBlock } from '#cli/system/managed-blocks.ts';
import { applyPlans, openWriter } from '#cli/ownership/writer.ts';
import { planBlock, planRestoration } from '#cli/ownership/plans.ts';
import { OWNERSHIP_REFUSAL } from '#tests/config/generated-files.ts';

{
    test('an edited or repeated managed block is kept and not overwritten', async () => {
        await using directory = await testdir();
        {
            using log = openWriter(directory.path);

            applyPlans(log, [planBlock(log, 'AGENTS.md', 'installed instructions', 'markdown')]);
            const edited = log.files
                .read('AGENTS.md')!
                .bytes.toString('utf8')
                .replace('installed instructions', 'authored instructions');
            await writeFile(join(directory.path, 'AGENTS.md'), edited);
            expect(() => {
                applyPlans(log, [planBlock(log, 'AGENTS.md', 'replacement', 'markdown')]);
            }).toThrow(`These files were not overwritten by gspot: AGENTS.md${OWNERSHIP_REFUSAL}`);
            expect(() => {
                applyPlans(log, [planRestoration(log, 'AGENTS.md')]);
            }).toThrow(`These files were not overwritten by gspot: AGENTS.md${OWNERSHIP_REFUSAL}`);
            expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(edited);
            await writeFile(join(directory.path, 'AGENTS.md'), edited + edited);
            expect(() => {
                applyPlans(log, [planBlock(log, 'AGENTS.md', 'replacement', 'markdown')]);
            }).toThrow('incomplete or repeated');
            expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(edited + edited);
        }
    });
}
{
    test('managed block updates and removal keep your text around the block', async () => {
        await using directory = await testdir();
        const original = '# Authored\r\n\r\nKeep these trailing lines.\r\n\r\n';
        await createFileTree(directory.path, { 'AGENTS.md': original });
        const prefix = 'Additional instructions.\n';
        const suffix = '\nLater authored instructions.\n';
        {
            using log = openWriter(directory.path);
            applyPlans(log, [planBlock(log, 'AGENTS.md', 'first instructions', 'markdown')]);
            const installed = log.files.read('AGENTS.md')!.bytes.toString('utf8');
            expect(installed.startsWith(original)).toBe(true);
            await writeFile(join(directory.path, 'AGENTS.md'), prefix + installed + suffix);
            applyPlans(log, [planBlock(log, 'AGENTS.md', 'updated instructions', 'markdown')]);
            expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(
                prefix +
                    applyBlock(original, 'updated instructions', { path: 'AGENTS.md', style: 'markdown' }) +
                    suffix,
            );
        }
        {
            using log = openWriter(directory.path);
            applyPlans(log, [planRestoration(log, 'AGENTS.md')]);
            expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(prefix + original + suffix);
        }
    });

    test('removing a block restores an originally empty file instead of deleting it', async () => {
        await using directory = await testdir();
        await createFileTree(directory.path, { 'AGENTS.md': '' });
        {
            using log = openWriter(directory.path);

            applyPlans(log, [planBlock(log, 'AGENTS.md', 'instructions', 'markdown')]);
            applyPlans(log, [planRestoration(log, 'AGENTS.md')]);
            expect(log.files.read('AGENTS.md')?.bytes).toStrictEqual(Buffer.alloc(0));
        }
    });
}
