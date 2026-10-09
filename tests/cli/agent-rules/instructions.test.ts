import { format } from 'prettier';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { managedBlock } from '#cli/agent-rules/contracts.ts';
import { selectRuleFiles } from '#cli/agent-rules/public.ts';
import { allChecks } from '#cli/configurations/contracts.ts';
import { everyManifest } from '#cli/configurations/public.ts';

async function blockFor(root: string): Promise<string> {
    const session = await openSession(root);
    const { agent_rules: rules, level } = session.policyFiles.policy;
    const selected = everyManifest(session.scopes);
    return managedBlock({
        rules,
        files: selectRuleFiles(rules, selected, session.repository, level, session.packageManifests),
        level,
        hasChecks: allChecks(selected).size > 0,
    });
}

describe('the managed block', () => {
    test('an empty manual language list retains general check instructions', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy([], { agentRules: true }) });
        const block = await blockFor(sandbox.path);
        expect(block).toContain('agent/WORKING.md');
        expect(block).toContain('Run `gspot check --staged` before committing');
        expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
    });

    test('with a check selected it names the command, and an excluded file leaves the index', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['spelling'], {
                agentRules: true,
                tables: '\n[agent_rules]\nexclude = ["general/engineering/code/ACCESSIBILITY.md"]\n',
            }),
        });
        const block = await blockFor(sandbox.path);
        expect(block).toContain('Run `gspot check --staged` before committing');
        expect(block).not.toContain('ACCESSIBILITY.md');
        expect(block).toContain('code/TESTING.md');
        expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
    });
});
