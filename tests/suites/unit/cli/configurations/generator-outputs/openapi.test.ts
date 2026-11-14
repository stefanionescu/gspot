import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a missing OpenAPI document is reported before generation', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['openapi'], {
            tables: '[openapi]\ndocument = "openapi.json"\ngenerate_command = ["bun", "generate.ts"]\n',
        }),
        'generate.ts': '',
    });

    using run = fakeCommands();
    expect(await runSandboxCheck(sandbox.path, 'openapi/stale-document')).toStrictEqual([
        matchFields({
            file: 'openapi.json',
            line: 1,
            rule: 'missing',
            message: expect.stringContaining('bun generate.ts') as string,
        }),
    ]);
    expect(run).not.toHaveBeenCalled();
});
