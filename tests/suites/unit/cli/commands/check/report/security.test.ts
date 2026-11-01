import { test, spyOn, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { stringify } from '@decimalturn/toml-patch';
import cliPackage from '#cli-package' with { type: 'json' };
import { CHECK_CODE } from '#cli/configurations/registry.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('unexpected check failures hide their stack until verbose while operational errors stay actionable', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'source.txt': 'Input.\n',
    });
    const code = CHECK_CODE['repository/encoding'];
    if (code?.check === undefined) throw new Error('The encoding check has no built-in code.');
    using failure = spyOn(code, 'check').mockImplementation(() => {
        throw new TypeError('Private failure stack');
    });
    const command = ['check', '--only', 'repository/encoding'];
    const concise = parseCheckReport(await runGspot(sandbox.path, [...command, '--json']));
    expect(concise.code).toBe(2);
    expect(concise.report.checks[0]?.note).toBe(
        `repository/encoding stopped because of an internal error in gspot. Report it at ${cliPackage.bugs.url}.`,
    );
    expect(concise.stdout).not.toContain('Private failure stack');
    const verbose = parseCheckReport(await runGspot(sandbox.path, [...command, '--verbose', '--json']));
    expect(verbose.report.checks[0]?.stack).toContain('TypeError: Private failure stack');
    const text = await runGspot(sandbox.path, [...command, '--verbose']);
    expect(text.stdout).toContain('TypeError: Private failure stack');
    failure.mockImplementation(() => {
        throw new GspotError('filesystem', 'Rename the unreadable file.');
    });
    const operational = parseCheckReport(await runGspot(sandbox.path, [...command, '--json']));
    expect(operational.code).toBe(2);
    expect(operational.report.checks[0]?.note).toBe('Rename the unreadable file.');
    expect(operational.report.checks[0]?.stack).toBeUndefined();
});

test('GitHub Actions fences untrusted report text with a unique token and leaves JSON intact', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'project/output',
                        stage: 'commit',
                        paths: ['source.txt'],
                        output: { format: 'lines' },
                        command: buildProgramCommand(
                            'fakes/tool',
                            '--stdout',
                            '::error::forged\n::add-mask::hidden\n',
                            '--exit',
                            '1',
                        ),
                    },
                ],
            }),
        }),
        'source.txt': 'Input.\n',
    });
    const command = ['check', '--only', 'project/output'];
    const ordinary = await runGspot(sandbox.path, command, { GITHUB_ACTIONS: 'false' });
    const guarded = await runGspot(sandbox.path, command, { GITHUB_ACTIONS: 'true' });
    const lines = guarded.stdout.trimEnd().split('\n');
    const token = lines[0]!.replace('::stop-commands::', '');
    expect(token).toMatch(/^[\da-f-]{36}$/u);
    expect(lines.at(-1)).toBe(`::${token}::`);
    expect(
        lines
            .slice(1, -1)
            .join('\n')
            .replaceAll(/\b\d+\.\ds\b/gu, '0.0s'),
    ).toBe(ordinary.stdout.trimEnd().replaceAll(/\b\d+\.\ds\b/gu, '0.0s'));
    const repeated = await runGspot(sandbox.path, command, { GITHUB_ACTIONS: 'true' });
    expect(repeated.stdout.split('\n', 1)[0]).not.toBe(lines[0]);
    const json = parseCheckReport(await runGspot(sandbox.path, [...command, '--json'], { GITHUB_ACTIONS: 'true' }));
    expect(json.code).toBe(1);
    expect(json.report.checks[0]?.findings.map(({ message }) => message)).toStrictEqual([
        '::error::forged',
        '::add-mask::hidden',
    ]);
});
