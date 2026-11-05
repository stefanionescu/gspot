import { stringify } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';

import cliPackage from '#cli-package' with { type: 'json' };
import { CHECK_CODE } from '#cli/configurations/registry.ts';
import { GspotError } from '#cli/system/errors.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

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
        `repository/encoding stopped because of an internal error in gspot. Report it at ${cliPackage.bugs.url}, with the stack that --verbose prints.`,
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
    const tables = stringify({
        command_check: [
            {
                id: 'project/output',
                stage: 'commit',
                paths: ['source.txt'],
                output: { format: 'regex', pattern: '(?<message>.+)' },
                command: buildProgramCommand(
                    'fakes/tool',
                    '--stdout',
                    '::error::forged\n::add-mask::hidden\n',
                    '--exit',
                    '1',
                ),
            },
        ],
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables }),
        'source.txt': 'Input.\n',
    });
    const command = ['check', '--only', 'project/output'];
    const ordinary = await runGspot(sandbox.path, command, { GITHUB_ACTIONS: 'false' });
    const guarded = await runGspot(sandbox.path, command, { GITHUB_ACTIONS: 'true' });
    const lines = guarded.stdout.trimEnd().split('\n');
    const token = lines[0]!.replace('::stop-commands::', '');
    expect(token).toMatch(/^[\da-f-]{36}$/u);
    const end = lines.indexOf(`::${token}::`);
    expect(lines.slice(end + 1)).toStrictEqual([
        '::error title=project/output::::error::forged',
        '::error title=project/output::::add-mask::hidden',
    ]);
    expect(
        lines
            .slice(1, end)
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

test('GitHub Actions gets an escaped error annotation for each finding, up to ten for the step', async () => {
    const findings = Array.from({ length: 12 }, (_, index) => `a,b.txt:${String(index + 1)}:2:R1:Use 100% of it.`);
    const tables = stringify({
        command_check: [
            {
                id: 'project/located',
                stage: 'commit',
                paths: ['a,b.txt'],
                output: {
                    format: 'regex',
                    pattern: String.raw`^(?<file>[^:]+):(?<line>\d+):(?<column>\d+):(?<rule>[^:]+):(?<message>.*)$`,
                },
                command: buildProgramCommand('fakes/tool', '--stdout', `${findings.join('\n')}\n`, '--exit', '1'),
            },
        ],
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables }),
        'a,b.txt': 'Input.\n',
    });
    const result = await runGspot(sandbox.path, ['check', '--only', 'project/located'], { GITHUB_ACTIONS: 'true' });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const annotations = result.stdout.split('\n').filter((line) => line.startsWith('::error '));
    expect(annotations).toHaveLength(10);
    expect(annotations[0]).toBe('::error file=a%2Cb.txt,line=1,col=2,title=project/located R1::Use 100%25 of it.');
    const outside = await runGspot(sandbox.path, ['check', '--only', 'project/located'], { GITHUB_ACTIONS: 'false' });
    expect(outside.stdout).not.toContain('::error ');
});
