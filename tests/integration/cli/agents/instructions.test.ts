import { describe, expect, test } from 'bun:test';
import { openSession } from '#cli/execution/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { everyManifest } from '#cli/configurations/select.ts';
import { managedBlock } from '#cli/agents/instructions.ts';
import { format } from 'prettier';

describe('the managed block', () => {
    test('with no check selected it says nothing about gspot check', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': 'version = 1\nconfigurations = []\n' });
        const session = await openSession(sandbox.path);
        const block = managedBlock(session.policyFiles.policy.rules, everyManifest(session.scopes));
        expect(block).toContain('general/agent/WORKING.md');
        expect(block).toContain('These files are installed copies');
        expect(block).not.toContain('gspot check');
        expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
    });

    test('with a check selected it names the command, and an excluded file leaves the index', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nconfigurations = ["spelling"]\n\n[rules]\nexclude = ["general/code/ACCESSIBILITY.md"]\n',
        });
        const session = await openSession(sandbox.path);
        const block = managedBlock(session.policyFiles.policy.rules, everyManifest(session.scopes));
        expect(block).toContain('Run `gspot check --staged` before committing');
        expect(block).not.toContain('ACCESSIBILITY.md');
        expect(block).toContain('general/code/NAMING.md');
        expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
    });
});
