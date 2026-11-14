import { test, expect } from 'bun:test';
import { getTool } from '#cli/manifests/tools.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { fakeToolExecutables } from '#tests/setup/cli/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('the jest pattern of a nested scope escapes its regex characters', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['jest'], { scopes: [{ path: 'packages/a.b' }] }),
        'jest.config.js': '',
        'source.test.js': '',
        'packages/a.b/jest.config.js': '',
    });
    using _pins = fakeToolExecutables([getTool(readConfigurations().values(), 'jest')]);
    using run = fakeCommands().mockResolvedValue(buildProcessResult());
    await runSandboxCheck(sandbox.path, 'jest/tests', { scope: '' });
    const pattern = new RegExp(run.mock.calls.at(-1)?.[0].at(-1) ?? '', 'u');
    expect(pattern.test('packages/aXb/x.test.ts')).toBe(true);
    expect(pattern.test('packages/a.b/x.test.ts')).toBe(false);
});
