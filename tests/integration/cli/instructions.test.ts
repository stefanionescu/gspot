import { format } from 'prettier';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { everyManifest } from '#cli/kits/select.ts';
import { openSession } from '#cli/execution/session.ts';
import { managedBlock } from '#cli/agents/instructions.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';

describe('the managed block', () => {
    test('with no check selected it says nothing about gspot check', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policyOf([]) });
        const session = await openSession(sandbox.path);
        const block = managedBlock(
            session.policyFiles.policy.guides,
            everyManifest(session.scopes),
            session.policyFiles.policy.level,
            session.repository,
        );
        expect(block).toContain('general/agent/WORKING.md');
        expect(block).not.toContain('gspot check');
        expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
    });

    test('with a check selected it names the command, and an excluded file leaves the index', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['spelling'], '\n[guides]\nexclude = ["general/code/ACCESSIBILITY.md"]\n'),
        });
        const session = await openSession(sandbox.path);
        const block = managedBlock(
            session.policyFiles.policy.guides,
            everyManifest(session.scopes),
            session.policyFiles.policy.level,
            session.repository,
        );
        expect(block).toContain('Run `gspot check --staged` before committing');
        expect(block).not.toContain('ACCESSIBILITY.md');
        expect(block).toContain('general/code/NAMING.md');
        expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
    });
});
