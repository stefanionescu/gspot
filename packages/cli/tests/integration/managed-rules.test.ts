import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { openSession } from '#cli/run/session.ts';
import { managedBlock } from '#cli/rules/managed-block.ts';

describe('the managed block', () => {
    test('with no check selected it says nothing about gspot check', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\npresets = []\n' });
        const block = managedBlock(await openSession(sandbox.path));
        expect(block).toContain('general/agent/WORKING.md');
        expect(block).toContain('These files are installed copies');
        expect(block).not.toContain('gspot check');
    });

    test('with a check selected it names the command, and an excluded file leaves the index', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\npresets = ["spelling"]\n\n[rules]\nexclude = ["general/code/ACCESSIBILITY.md"]\n',
        });
        const block = managedBlock(await openSession(sandbox.path));
        expect(block).toContain('Run `gspot check --staged` before committing');
        expect(block).not.toContain('ACCESSIBILITY.md');
        expect(block).toContain('general/code/NAMING.md');
    });
});
