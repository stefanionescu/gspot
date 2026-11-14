import { testdir } from 'testdirs';
import { delimiter } from 'node:path';
import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { runGspot } from '#tests/setup/cli/commands.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { findProgram } from '#cli/system/processes/programs.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { writeProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/cli/settings.ts';

const COMMAND = ['check', '--only', 'sandbox/finding'];

const PATH_WITHOUT_GSPOT = (readEnvironmentVariable('PATH') ?? '')
    .split(delimiter)
    .filter((folder) => findProgram('gspot', folder) === undefined)
    .join(delimiter);

function buildFiles(paths: string[]): Record<string, string> {
    const check = buildReportingCheck({ id: 'sandbox/finding', paths, stage: 'commit' });
    return {
        'gspot.toml': buildSandboxSettings([], { tables: stringify({ command_check: [check] }) }),
        'source.txt': 'input\n',
    };
}

const NPM_PACKAGE = JSON.stringify({
    packageManager: 'npm@11.10.1',
    devDependencies: { [cliPackage.name]: cliPackage.version },
});

test('a failed run in an npm repository names the start command when gspot is not on the PATH', async () => {
    await using sandbox = await createGitSandbox({ ...buildFiles(['source.txt']), 'package.json': NPM_PACKAGE });
    const result = await runGspot(sandbox.path, COMMAND, { PATH: PATH_WITHOUT_GSPOT });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).toContain('note     To run the lines above, write npm exec --no -- gspot in place of gspot.');
});

test('a failed run in an npm repository adds no line when gspot is on the PATH', async () => {
    await using sandbox = await createGitSandbox({ ...buildFiles(['source.txt']), 'package.json': NPM_PACKAGE });
    await using programs = await testdir({});
    const folder = await writeProgramCommand(programs.path, 'bin/gspot', 'fakes/tool');
    const result = await runGspot(sandbox.path, COMMAND, { PATH: `${folder}${delimiter}${PATH_WITHOUT_GSPOT}` });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stdout).not.toContain('in place of gspot');
});

test('a failed run in a mise repository names mise exec', async () => {
    await using failing = await createGitSandbox(buildFiles(['source.txt']));
    const failed = await runGspot(failing.path, COMMAND);
    expect(failed.stdout).toContain('write mise exec -- gspot in place of gspot.');
});
