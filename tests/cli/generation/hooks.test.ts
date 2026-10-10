import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { hookFiles } from '#cli/generation/contracts.ts';
import { parseStrictPolicy } from '#cli/policy/public.ts';

test('a repository at the Git top level enters no folder', async () => {
    await using sandbox = await testdir();
    gitOutput(sandbox.path, ['init', '-q']);
    const policy = parseStrictPolicy(buildPolicy([], { agentRules: true, tables: '[hooks]\nenabled = true\n' }));
    const files = hookFiles(sandbox.path, policy, '1.2.3');
    expect(files).toHaveLength(3);
    for (const file of files) expect(file.content).not.toContain('\ncd ');
});
