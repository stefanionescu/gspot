import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { stringify } from '@decimalturn/toml-patch';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test.each(['{file}', '{files}'])(
    '%s keeps filenames beginning with a dash out of tool options',
    async (placeholder) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([], {
                tables: stringify({
                    command_check: [
                        {
                            id: 'project/dashed-files',
                            command: buildProgramCommand(
                                'checks/search',
                                '--text',
                                'invalid',
                                '--report',
                                'message',
                                '--message',
                                'Check this file.',
                                '--',
                                placeholder,
                            ),
                            paths: ['*.sh', '*.mjs'],
                            stage: 'commit',
                            output: {
                                format: 'regex',
                                pattern: String.raw`^(?<file>[^:]+):(?<line>\d+): (?<message>.*)$`,
                            },
                        },
                    ],
                }),
            }),
            '-f.sh': 'invalid',
            '--config=x.mjs': 'invalid',
        });
        const result = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['project/dashed-files'] }),
        );
        expect(result.report.exitCode).toBe(1);
        expect(result.report.checks).toMatchObject([{ status: 'failed', fileCount: 2 }]);
        expect(
            result.report.checks
                .flatMap(({ findings }) => findings.map(({ file }) => file))
                .toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['--config=x.mjs', '-f.sh']);
    },
);
