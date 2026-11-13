import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run/checks.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('a check that reports a file of its own and the files that gspot writes keeps the findings outside the gspot files', async () => {
    const lines = [
        '.gspot/configurations/javascript/eslint/functions.mjs:1: A type error.',
        'eslint.config.mjs:1: A type error.',
        'source.txt:1: A type error.',
    ];
    const command = buildProgramCommand('fakes/tool', ...lines.flatMap((line) => ['--line', line]), '--exit', '1');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: stringify({
                command_check: [
                    {
                        id: 'project/types',
                        command,
                        paths: ['source.txt'],
                        stage: 'commit',
                        exit_codes: [1],
                        output: {
                            format: 'regex',
                            pattern: String.raw`^(?<file>.+):(?<line>\d+): (?<message>.+)$`,
                        },
                    },
                ],
            }),
        }),
        'source.txt': 'Input.\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['project/types'] }));
    expect(result.report.checks).toMatchObject([{ check: 'project/types', status: 'failed' }]);
    expect(result.report.checks[0]?.findings.map(({ file }) => file)).toStrictEqual(['source.txt']);
});
