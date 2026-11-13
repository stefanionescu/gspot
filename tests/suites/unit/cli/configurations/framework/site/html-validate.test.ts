import { writeFile } from 'node:fs/promises';

import { expect, test } from 'bun:test';

import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { fakeNpmTool } from '#tests/setup/cli/tools.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('html-validate that fails without a finding stops with an error', async () => {
    const buildCommand = buildProgramCommand('fakes/site-build', '--copy', 'index.html=dist/index.html');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(buildCommand)}\n`,
        }),
        'index.html': '<!doctype html><html lang="en"><title>Home</title></html>\n',
    });
    await fakeNpmTool(sandbox.path, 'html-validate');
    using _run = fakeCommands('html-validate', async (command) => {
        const report = command.find((argument) => argument.startsWith('json='))!.slice('json='.length);
        await writeFile(report, '[]');
        return buildProcessResult({ code: 1, stderr: 'Cannot load the configuration.' });
    });
    const error = await captureRejection(runSandboxCheck(sandbox.path, 'site/html-validate'));
    expect(error).toMatchObject({ name: 'CheckStop', status: 'error' });
});
