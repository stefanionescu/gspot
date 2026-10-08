import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { applyBlock } from '#cli/platform/managed-blocks.ts';
import { planBlock } from '#cli/lifecycle/ownership/plans.ts';
import { applyPlan } from '#cli/lifecycle/ownership/commit.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { planRestoration } from '#cli/lifecycle/ownership/restoration.ts';

test('managed block updates and removal preserve authored bytes and subsequent surrounding edits', async () => {
    await using directory = await testdir();
    const original = '# Authored\r\n\r\nKeep these trailing lines.\r\n\r\n';
    await createFileTree(directory.path, { 'AGENTS.md': original });
    let log = openOwnership(directory.path);
    try {
        expect(applyPlan(log, planBlock(log, 'AGENTS.md', 'first instructions', 'markdown'))).toBe('changed');
        const installed = log.files.read('AGENTS.md')!.bytes.toString('utf8');
        expect(installed.startsWith(original)).toBe(true);
        const prefix = 'Additional instructions.\n';
        const suffix = '\nLater authored instructions.\n';
        await writeFile(join(directory.path, 'AGENTS.md'), prefix + installed + suffix);
        expect(applyPlan(log, planBlock(log, 'AGENTS.md', 'updated instructions', 'markdown'))).toBe('changed');
        expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(
            prefix + applyBlock(original, 'updated instructions', { path: 'AGENTS.md', style: 'markdown' }) + suffix,
        );
        log[Symbol.dispose]();
        log = openOwnership(directory.path);
        expect(applyPlan(log, planRestoration(log, 'AGENTS.md'))).toBe('changed');
        expect(log.files.read('AGENTS.md')!.bytes.toString('utf8')).toBe(prefix + original + suffix);
    } finally {
        log[Symbol.dispose]();
    }
});

test('removing a block restores an originally empty file instead of deleting it', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { 'AGENTS.md': '' });
    {
        using log = openOwnership(directory.path);

        expect(applyPlan(log, planBlock(log, 'AGENTS.md', 'instructions', 'markdown'))).toBe('changed');
        expect(applyPlan(log, planRestoration(log, 'AGENTS.md'))).toBe('changed');
        expect(log.files.read('AGENTS.md')?.bytes).toStrictEqual(Buffer.alloc(0));
    }
});
