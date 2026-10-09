import { format } from 'prettier';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { allChecks } from '#cli/configurations/contracts.ts';
import { managedBlock } from '#cli/agent-rules/contracts.ts';
import { selectRuleFiles } from '#cli/agent-rules/public.ts';
import { everyManifest } from '#cli/configurations/public.ts';

describe('the managed block', () => {
    test('an empty manual language list retains general check instructions', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy([]) });
        const session = await openSession(sandbox.path);
        const { agent_rules: rules, level } = session.policyFiles.policy;
        const selected = everyManifest(session.scopes);
        const block = managedBlock({
            rules,
            files: selectRuleFiles(rules, selected, session.repository, level, session.packageManifests),
            level,
            hasChecks: allChecks(selected).size > 0,
        });
        expect(block).toContain('agent/WORKING.md');
        expect(block).toContain('Run `gspot check --staged` before committing');
        expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
    });

    test('with a check selected it names the command, and an excluded file leaves the index', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['spelling'], {
                tables: '\n[agent_rules]\nexclude = ["general/engineering/code/ACCESSIBILITY.md"]\n',
            }),
        });
        const session = await openSession(sandbox.path);
        const { agent_rules: rules, level } = session.policyFiles.policy;
        const selected = everyManifest(session.scopes);
        const block = managedBlock({
            rules,
            files: selectRuleFiles(rules, selected, session.repository, level, session.packageManifests),
            level,
            hasChecks: allChecks(selected).size > 0,
        });
        expect(block).toContain('Run `gspot check --staged` before committing');
        expect(block).not.toContain('ACCESSIBILITY.md');
        expect(block).toContain('code/TESTING.md');
        expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
    });
});
