import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('nested-files reports an AGENTS.md outside the repository root', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'AGENTS.md': '# Rules\n',
        'packages/app/AGENTS.md': '# Rules\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'agents/nested-files');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'packages/app/AGENTS.md', rule: 'nested-agents-file' },
    ]);
});
