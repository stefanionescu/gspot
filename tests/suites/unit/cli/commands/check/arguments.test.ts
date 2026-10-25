import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { commitAll, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { ALL_FILES_BASES, NAMING_SCOPE_SETTINGS } from '#tests/config/commands/check/arguments.ts';

test('file and folder arguments narrow the files each check gets', async () => {
    await using sandbox = await createGitSandbox({});
    const checks = ['one', 'two', 'three'].map((name) =>
        buildReportingCheck({ id: `sandbox/${name}`, paths: ['src/**', 'docs/**'], stage: 'commit' }),
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: stringify({ command_check: checks }) }),
        'src/selected.ts': 'selected',
        'src/other.ts': 'other',
        'docs/guide.md': '# Guide\n',
    });
    const checked = parseCheckReport(
        await runGspot(sandbox.path, [
            'check',
            'src/selected.ts',
            'docs',
            '--only',
            'sandbox/one,sandbox/two',
            '--json',
        ]),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.checks.map((check) => check.check)).toStrictEqual(['sandbox/one', 'sandbox/two']);
    for (const check of checked.report.checks)
        expect(new Set(check.findings.map((finding) => finding.message))).toStrictEqual(
            new Set(['docs/guide.md', 'src/selected.ts']),
        );
});

test('--only repeats and leaves the paths after it as paths', async () => {
    await using sandbox = await createGitSandbox({});
    const checks = ['one', 'two', 'three'].map((name) =>
        buildReportingCheck({ id: `sandbox/${name}`, paths: ['src/**'], stage: 'commit' }),
    );
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: stringify({ command_check: checks }) }),
        'src/selected.ts': 'selected',
        'src/other.ts': 'other',
    });
    const checked = parseCheckReport(
        await runGspot(sandbox.path, [
            'check',
            '--only',
            'sandbox/one',
            'src/selected.ts',
            '--only',
            'sandbox/two',
            '--json',
        ]),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.checks.map((check) => check.check)).toStrictEqual(['sandbox/one', 'sandbox/two']);
    for (const check of checked.report.checks)
        expect(check.findings.map((finding) => finding.message)).toStrictEqual(['src/selected.ts']);
});

test.each([false, true])('path arguments narrow project-wide findings (staged: %s)', async (staged) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    {
                        id: 'sandbox/project',
                        paths: ['src/**'],
                        stage: 'commit',
                        command: buildProgramCommand(
                            'fakes/tool',
                            '--stdout',
                            'src/selected.ts:demo:here\nsrc/other.ts:demo:elsewhere\n:demo:fileless\n',
                            '--exit',
                            '1',
                        ),
                        output: { format: 'regex', pattern: '^(?<file>[^:]*):(?<rule>[^:]+):(?<message>.*)$' },
                    },
                ],
            }),
        }),
        'src/selected.ts': 'selected',
        'src/other.ts': 'other',
    });
    if (staged) {
        commitAll(sandbox.path);
        await createFileTree(sandbox.path, { 'src/selected.ts': 'changed selected', 'src/other.ts': 'changed other' });
        runGitStep(sandbox.path, ['add', '--', 'src/selected.ts', 'src/other.ts']);
    }
    const flags = staged ? ['--staged'] : [];
    const narrowed = parseCheckReport(
        await runGspot(sandbox.path, ['check', 'src/selected.ts', '--only', 'sandbox/project', '--json', ...flags]),
    );
    expect(narrowed.code, narrowed.stdout + narrowed.stderr).toBe(1);
    expect(narrowed.report.checks[0]?.reproduce).toBe(
        `gspot check src/selected.ts --only sandbox/project${staged ? ' --staged' : ''}`,
    );
    expect(narrowed.report.checks[0]?.findings.map((finding) => finding.message)).toStrictEqual(['here', 'fileless']);
    const project = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'sandbox/project', '--json', ...flags]),
    );
    expect(project.report.checks[0]?.findings.map((finding) => finding.message)).toStrictEqual([
        'here',
        'elsewhere',
        'fileless',
    ]);
});

test.each([false, true])('run again resolves a scope from the calling folder (staged: %s)', async (staged) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { scopes: [{ path: 'app', configurations: ['bash'] }] }),
        'app/run.sh': 'cleanup() { printf "unused\\n"; }\n',
        'sub/marker.txt': 'source\n',
    });
    if (staged) {
        commitAll(sandbox.path);
        await writeFile(join(sandbox.path, 'app/run.sh'), 'cleanup() { printf "changed\\n"; }\n');
        runGitStep(sandbox.path, ['add', '--', 'app/run.sh']);
    }
    const cwd = join(sandbox.path, 'sub');
    const result = parseCheckReport(
        await runGspot(cwd, ['check', '--only', 'bash/unused-functions', '--json', ...(staged ? ['--staged'] : [])]),
    );
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const reproduce = result.report.checks[0]!.reproduce!;
    expect(reproduce).toBe(`gspot check ../app --only bash/unused-functions${staged ? ' --staged' : ''}`);
    const repeated = parseCheckReport(await runGspot(cwd, [...reproduce.split(' ').slice(1), '--json']));
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    expect(repeated.report.checks[0]?.findings).toStrictEqual(result.report.checks[0]?.findings);
});

test('--staged keeps every stage while --hook pre-commit runs only commit checks', async () => {
    const definitions = (['commit', 'push', 'manual'] as const).map((stage) => buildPassingCheck(stage));
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: stringify({ command_check: definitions }) }),
        'source.txt': 'input',
    });

    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'source.txt'), 'staged input');
    runGitStep(sandbox.path, ['add', 'source.txt']);
    const staged = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'sandbox/commit,sandbox/push', '--staged', '--json']),
    );
    expect(staged.code, staged.stdout + staged.stderr).toBe(0);
    expect(staged.report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['sandbox/commit', 'passed'],
        ['sandbox/push', 'passed'],
    ]);
    const checked = parseCheckReport(
        await runGspot(sandbox.path, [
            'check',
            '--only',
            'sandbox/commit,sandbox/push',
            '--hook',
            'pre-commit',
            '--json',
        ]),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(checked.report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['sandbox/commit', 'passed'],
    ]);
});

test('a manual check runs only when --only names it', async () => {
    const files = {
        'gspot.toml': buildSandboxSettings([], { tables: stringify({ command_check: [buildPassingCheck('manual')] }) }),
        'source.txt': 'input',
    };
    await using sandbox = await createGitSandbox(files);

    const unscoped = parseCheckReport(await runGspot(sandbox.path, ['check', '--json']));
    expect(unscoped.report.checks.map((check) => check.check)).not.toContain('sandbox/manual');
    const named = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'sandbox/manual', '--json']));
    expect(named.code, named.stdout + named.stderr).toBe(0);
    expect(named.report.checks.map((check) => [check.check, check.status])).toStrictEqual([
        ['sandbox/manual', 'passed'],
    ]);
});

test('a scope path narrows to its checks and its reproduce command finds the same findings', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], NAMING_SCOPE_SETTINGS),
        'api/port.js': 'export const helperCommand = 1;\n',
        'web/port.js': 'export const helperCommand = 2;\n',
    });

    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', 'api', '--only', 'naming/identifiers', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const failed = checked.report.checks.filter((check) => check.status === 'failed');
    expect(failed.map(({ scope, reproduce }) => ({ scope, reproduce }))).toStrictEqual([
        { scope: 'api', reproduce: 'gspot check api --only naming/identifiers' },
    ]);
    const [, ...reproduce] = failed[0]!.reproduce!.split(' ');
    const repeated = parseCheckReport(await runGspot(sandbox.path, [...reproduce, '--json']));
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    expect(repeated.report.checks.flatMap((check) => check.findings)).toStrictEqual(
        checked.report.checks.flatMap((check) => check.findings),
    );
});

test('a staged change to gspot.toml alone rechecks every file a configuration check covers', async () => {
    const loose = buildSandboxSettings(['sql'], {
        tables: '[limits.sql]\nfile_lines = 100\n',
        level: 'all',
    });
    const body = Array.from({ length: 12 }, (_, index) => `SELECT ${String(index)};`).join('\n');
    await using sandbox = await testdir({
        'gspot.toml': loose,
        'db/report.sql': `${body}\n`,
    });

    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'gspot.toml'), loose.replace('file_lines = 100', 'file_lines = 5'));
    runGitStep(sandbox.path, ['add', 'gspot.toml']);
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--staged', '--only', 'structure/long-files', '--json']),
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(checked.report.checks[0]?.findings).toMatchObject([{ file: 'db/report.sql', rule: 'file-lines' }]);
});

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function buildPassingCheck(stage: 'commit' | 'push' | 'manual') {
    return {
        id: `sandbox/${stage}`,
        command: buildProgramCommand('fakes/tool'),
        paths: ['source.txt'],
        stage,
    };
}

test.each([...ALL_FILES_BASES])(
    'an explicit full-run base reports its cause: $message',
    async ({ reference, message }) => {
        const files = {
            'gspot.toml': buildSandboxSettings([], {
                tables: stringify({
                    command_check: [buildReportingCheck({ id: 'sandbox/all', paths: ['*.txt'], stage: 'commit' })],
                }),
            }),
            'one.txt': 'one',
            'two.txt': 'two',
        };
        await using sandbox = await createGitSandbox(files);
        const result = await runGspot(sandbox.path, ['check', '--changed', reference, '--only', 'sandbox/all']);
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(result.stdout).toStartWith(message + '\n');
        expect(result.stdout).toContain('one.txt');
        expect(result.stdout).toContain('two.txt');
    },
);
