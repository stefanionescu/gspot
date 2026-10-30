import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { stringify } from '@decimalturn/toml-patch';
import { isWindows } from '#tests/setup/system/platform.ts';
import { MILLISECONDS_PER_SECOND } from '#cli/config/units.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { GSPOT_ENVIRONMENT } from '#tests/config/setup/environment.ts';
import { CLI_BIN, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { UNIT_TEST_TIMEOUT_MILLISECONDS } from '#tests/config/setup/runner.ts';
import { CANCELLATION_REPORT_CASES } from '#tests/config/commands/check/cancellation.ts';
import { waitForExit, waitForFile, spawnCommand } from '#tests/setup/system/processes.ts';

test.skipIf(isWindows).each(CANCELLATION_REPORT_CASES)(
    'check passes $signal to a running tool and reports the run as canceled in $format',
    async ({ signal, format }) => {
        const command = buildProgramCommand('fakes/tool', '--mark', 'started.pid', '--wait');
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([], {
                tables: stringify({
                    command_check: [
                        {
                            id: 'project/slow',
                            stage: 'commit',
                            paths: ['source.txt'],
                            command: command,
                        },
                    ],
                }),
            }),
            'source.txt': 'input\n',
        });

        await using capture = spawnCommand(
            [process.execPath, CLI_BIN, 'check', '--only', 'project/slow', ...(format === 'json' ? ['--json'] : [])],
            {
                cwd: sandbox.path,
                timeoutSeconds: (UNIT_TEST_TIMEOUT_MILLISECONDS - MILLISECONDS_PER_SECOND) / MILLISECONDS_PER_SECOND,
                env: GSPOT_ENVIRONMENT,
            },
        );
        const { child } = capture;
        const started = join(sandbox.path, 'started.pid');
        expect(await waitForFile(started)).toBe(true);
        const toolPid = Number(await readFile(started, 'utf8'));
        child.kill(signal);
        const exitCode = signal === 'SIGINT' ? 130 : 143;
        expect(await child.exited, await capture.stderr).toBe(exitCode);
        if (format === 'json') {
            const report = parseCheckReport({
                code: await child.exited,
                stdout: await capture.stdout,
                stderr: await capture.stderr,
            }).report;
            expect(report.exitCode).toBe(exitCode);
            expect(report.checks).toMatchObject([
                { check: 'project/slow', status: 'error', note: `${process.execPath} was canceled.` },
            ]);
        } else {
            const stdout = await capture.stdout;
            expect(stdout).toContain(`${process.execPath} was canceled.`);
            expect(stdout).toContain(`Exit code ${String(exitCode)}.`);
        }
        await waitForExit(toolPid);
    },
);
