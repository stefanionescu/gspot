import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import type { Session } from '#cli/types/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('a check that needs no generated files never calls the injected generators', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'source.sh': '#!/bin/sh\nprintf "%s\\n" example\n',
    });
    const selected: string[] = [];
    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({
            only: ['bash/safety'],
            generation: {
                buildConfigs: () => {
                    throw new Error('Unexpected config generation.');
                },
                listOutdatedFiles: () => {
                    throw new Error('Unexpected generated-file comparison.');
                },
            },
            selectCheckCode: (check) => {
                selected.push(check.id);
                return {
                    check: () => [{ file: 'source.sh', rule: 'injected', message: 'Selected implementation ran.' }],
                };
            },
        }),
    );
    expect(selected).toStrictEqual(['bash/safety']);
    expect(result.report.checks).toMatchObject([{ status: 'failed', findings: [{ rule: 'injected' }] }]);
});

test('a fixed run keeps the injected generation and reads the reopened file inventory', async () => {
    await using sandbox = await createGitSandbox({
        'source.txt': 'input',
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'project/inventory',
                        stage: 'commit',
                        paths: ['*.txt'],
                        command: buildProgramCommand('fakes/tool'),
                        fix: buildProgramCommand('fakes/tool', '--write', 'added.txt=created'),
                    },
                ],
            }),
        }),
    });
    const initial = await openSession(sandbox.path);
    let generated: Session | undefined;
    const selected: string[] = [];
    const result = await runChecks(
        initial,
        buildRunOptions({
            only: ['project/inventory'],
            fix: true,
            verbose: true,
            generation: {
                buildConfigs: () => {
                    throw new Error('Unexpected config generation.');
                },
                listOutdatedFiles: (session, options) => {
                    generated = session;
                    expect(options.verbose).toBe(true);
                    return Promise.resolve([]);
                },
            },
            selectCheckCode: (check) => {
                selected.push(check.id);
                return {
                    check: async (session, _planned, options = {}) => {
                        await session.generation.listOutdatedFiles(session, options);
                        return [];
                    },
                };
            },
        }),
    );
    expect(result.report.exitCode).toBe(0);
    expect(selected).toStrictEqual(['project/inventory', 'project/inventory']);
    expect(generated).not.toBe(initial);
    expect(generated?.repository.files.map(({ path }) => path)).toContain('added.txt');
    expect(initial.repository.files.map(({ path }) => path)).not.toContain('added.txt');
});
