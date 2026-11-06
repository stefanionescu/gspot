import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import type { CommandFailureJson } from '#cli/types/system.ts';
import { NAMING_SCOPE_SETTINGS } from '#tests/config/commands/check.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildReportingCheck, buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

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

test.each([
    {
        path: 'bash/shellcheck',
        message: 'Path bash/shellcheck matches no repository files. To name two checks, write --only a,b.',
    },
    {
        path: 'sandbox/own',
        message: 'Path sandbox/own matches no repository files. To name two checks, write --only a,b.',
    },
    { path: 'src/gone.ts', message: 'Path src/gone.ts matches no repository files.' },
])('the path $path that matches no file gets its message', async ({ path, message }) => {
    const tables = stringify({
        command_check: [buildReportingCheck({ id: 'sandbox/own', paths: ['*'], stage: 'commit' })],
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables }),
        'README.md': '# Example\n',
    });
    const result = await runGspot(sandbox.path, ['check', '--only', 'sandbox/own', path, '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'arguments', message });
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

test.each([false, true])('path arguments narrow project-wide findings (staged: %p)', async (staged) => {
    const tables = stringify({
        command_check: [
            {
                id: 'sandbox/project',
                paths: ['src/**'],
                stage: 'commit',
                command: buildProgramCommand(
                    'fakes/tool',
                    '--stdout',
                    'src/selected.ts:demo:here\nsrc/other.ts:demo:elsewhere\n:demo:fileless\nnode_modules/pkg/index.d.ts:demo:installed\n',
                    '--exit',
                    '1',
                ),
                output: { format: 'regex', pattern: '^(?<file>[^:]*):(?<rule>[^:]+):(?<message>.*)$' },
            },
        ],
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables }),
        '.gitignore': 'node_modules/\n',
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
    expect(narrowed.report.checks[0]?.rerun).toBe(
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
        'installed',
    ]);
});

test('a named folder keeps the finding of an ignored file in it, and a named file passes without it', async () => {
    const tables = stringify({
        command_check: [
            {
                id: 'sandbox/site',
                paths: ['web/**'],
                stage: 'commit',
                command: buildProgramCommand(
                    'fakes/tool',
                    '--stdout',
                    'web/dist/page.html:demo:built\n',
                    '--exit',
                    '1',
                ),
                output: { format: 'regex', pattern: '^(?<file>[^:]*):(?<rule>[^:]+):(?<message>.*)$' },
            },
        ],
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables }),
        '.gitignore': 'dist/\n',
        'web/page.ts': 'page',
        'web/dist/page.html': 'built',
    });
    const folder = parseCheckReport(await runGspot(sandbox.path, ['check', 'web', '--only', 'sandbox/site', '--json']));
    expect(folder.code, folder.stdout + folder.stderr).toBe(1);
    expect(folder.report.checks[0]?.findings.map(({ file }) => file)).toStrictEqual(['web/dist/page.html']);
    const named = parseCheckReport(
        await runGspot(sandbox.path, ['check', 'web/page.ts', '--only', 'sandbox/site', '--json']),
    );
    expect(named.code, named.stdout + named.stderr).toBe(0);
    expect(named.report.checks[0]).toMatchObject({ status: 'passed', findings: [] });
});

test.each([false, true])('rerun resolves a scope from the calling folder (staged: %p)', async (staged) => {
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
    const rerun = result.report.checks[0]!.rerun!;
    expect(rerun).toBe(`gspot check ../app --only bash/unused-functions${staged ? ' --staged' : ''}`);
    const repeated = parseCheckReport(await runGspot(cwd, [...rerun.split(' ').slice(1), '--json']));
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    expect(repeated.report.checks[0]?.findings).toStrictEqual(result.report.checks[0]?.findings);
});

test('--staged keeps every stage while --only commit selects only commit checks', async () => {
    const definitions = (['commit', 'push', 'manual'] as const).map((stage) => ({
        id: `sandbox/${stage}`,
        command: buildProgramCommand('fakes/tool'),
        paths: ['source.txt'],
        stage: stage,
    }));
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
    const checked = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'commit', '--staged', '--json']));
    const committed = checked.report.checks.map((check) => check.check);
    expect(committed).toContain('sandbox/commit');
    expect(committed).not.toContain('sandbox/push');
    expect(committed).not.toContain('sandbox/manual');
    expect(checked.report.stages).toStrictEqual(['commit']);
    const pushed = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', 'push', '--json']));
    const pushChecks = pushed.report.checks.map((check) => check.check);
    expect(pushChecks).toContain('sandbox/push');
    expect(pushChecks).not.toContain('sandbox/commit');
    expect(pushed.report.stages).toStrictEqual(['push']);
});

test('a manual check runs only when --only names it', async () => {
    const files = {
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: `sandbox/manual`,
                        command: buildProgramCommand('fakes/tool'),
                        paths: ['source.txt'],
                        stage: 'manual',
                    },
                ],
            }),
        }),
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

test('a scope path narrows to its checks and its rerun command finds the same findings', async () => {
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
    expect(failed.map(({ scope, rerun }) => ({ scope, rerun }))).toStrictEqual([
        { scope: 'api', rerun: 'gspot check api --only naming/identifiers' },
    ]);
    const [, ...rerun] = failed[0]!.rerun!.split(' ');
    const repeated = parseCheckReport(await runGspot(sandbox.path, [...rerun, '--json']));
    expect(repeated.code, repeated.stdout + repeated.stderr).toBe(1);
    expect(repeated.report.checks.flatMap((check) => check.findings)).toStrictEqual(
        checked.report.checks.flatMap((check) => check.findings),
    );
});

test.each([
    { flags: ['--only', 'commit,python/ruff'], message: '--only commit runs every check of that stage' },
    { flags: ['--only', 'push', '--only', 'python/ruff'], message: '--only push runs every check of that stage' },
    { flags: ['--only', 'commit', '--hook', 'pre-push'], message: '--only commit cannot run with --hook' },
])('$flags is refused, because a stage takes no other selection', async ({ flags, message }) => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const result = await runGspot(sandbox.path, ['check', ...flags, '--json']);
    expect(result.code).toBe(2);
    const failure = JSON.parse(result.stdout) as CommandFailureJson;
    expect(failure.error).toBe('arguments');
    expect(failure.message).toContain(message);
});
