import { writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';

import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('staged error notes and command arguments name the working root instead of the copy', async () => {
    const command = buildProgramCommand('fakes/tool', '--stderr', 'Cannot read {root}/settings.json', '--exit', '2');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'project/path-error',
                        stage: 'commit',
                        paths: ['source.txt'],
                        command,
                    },
                ],
            }),
        }),
        'source.txt': 'input',
    });
    runGitStep(sandbox.path, ['add', '-A']);
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--staged', '--only', 'project/path-error', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(checked.report.checks[0]!.note).toContain(`${sandbox.path}/settings.json`);
    expect(checked.report.checks[0]!.command).toStrictEqual(
        command.map((argument) => argument.replaceAll('{root}', () => sandbox.path)),
    );
});

test('a staged check with nothing staged prints that and exits 0 without copying the index', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh': CLEAN_BASH_SCRIPT,
    });
    await applyGeneratedFiles(sandbox.path);
    commitAll(sandbox.path);
    const temporaryFile = join(sandbox.path, '.git', 'temporary-file');
    await writeFile(temporaryFile, '');
    using _temporaryFolder = spyOn(os, 'tmpdir').mockReturnValue(temporaryFile);
    const checked = parseCheckReport(await runGspot(sandbox.path, ['check', '--staged', '--json']));
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks).toStrictEqual([]);
    expect(checked.report.notes).toStrictEqual(['Nothing is staged.']);
    const printed = await runGspot(sandbox.path, ['check', '--staged']);
    expect({ code: printed.code, stdout: printed.stdout }).toStrictEqual({ code: 0, stdout: 'Nothing is staged.\n' });
});
