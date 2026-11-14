import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

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
});
