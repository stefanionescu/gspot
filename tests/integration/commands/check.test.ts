import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { testdir, createFileTree } from 'testdirs';
import { join, dirname, delimiter } from 'node:path';
import { isWindows } from '#tests/setup/system/platform.ts';
import { type PushReport } from '#cli/types/commands/check.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import { BASH_SYNTAX_CHECK } from '#tests/data/runs/command.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/sandbox.ts';
import { chmod, symlink, readFile, writeFile } from 'node:fs/promises';
import { runGit, commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { PARTIAL_FIX_CASES, TAB_FORMAT_SETTINGS } from '#tests/data/integration/commands.ts';
import { spawnGspot, parseCheckReport, buildInitArguments, installGeneratedTools } from '#tests/setup/cli/commands.ts';

test('bash/shellcheck without ShellCheck on PATH exits 2 and names the pinned version, while bash/function-size passes and bash/shellcheck passes on the full PATH', async () => {
    await using sandbox = await testdir({
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        '.gitignore': 'home/\nbin/\n',
        home: {},
        bin: {},
    });

    commitAll(sandbox.path);
    const bin = join(sandbox.path, 'bin');
    const gitPath = Bun.which('git');
    expect(gitPath).not.toBeNull();
    await symlink(process.execPath, join(bin, isWindows ? 'bun.exe' : 'bun'));
    // Git for Windows finds its installation from the folder git.exe sits in, which holds no lint tool.
    if (!isWindows) await symlink(gitPath!, join(bin, 'git'));
    const path = isWindows ? `${bin}${delimiter}${dirname(gitPath!)}` : bin;
    const environment = {
        PATH: path,
        HOME: join(sandbox.path, 'home'),
        MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
    };
    const initialized = await spawnGspot(sandbox.path, buildInitArguments(['bash']), {
        ...environment,
    });
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(initialized.stdout + initialized.stderr).toContain('Next: run gspot install');
    const check = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck'], environment);
    expect(check.code).toBe(2);
    expect(check.stdout).toContain(
        `shellcheck ${String(getTool([...readConfigurations().values()], 'shellcheck').version)} is not installed`,
    );
    const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const builtIn = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'bash/function-size', '--json'], environment),
    );
    expect(builtIn.code, builtIn.stdout + builtIn.stderr).toBe(0);
    expect(builtIn.report.checks).toMatchObject([{ check: 'bash/function-size', status: 'passed', findings: [] }]);
    const available = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']),
    );
    expect(available.code, available.stdout + available.stderr).toBe(0);
    expect(available.report.checks).toMatchObject([{ check: 'bash/shellcheck', status: 'passed', findings: [] }]);
});
test('a pre-push check in a shallow clone passes project/bash-syntax and refuses commits/commitlint-pushed until git fetch --unshallow', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');

    await createFileTree(source, {
        'gspot.toml': buildSandboxSettings(['bash', 'commits'], { tables: BASH_SYNTAX_CHECK, level: 'all' }),
        'source.sh': 'echo base\n',
    });
    expect(runGit(source, ['init', '-q']).code).toBe(0);

    await installGeneratedTools(source);
    expect(runGit(source, ['add', '-A']).code).toBe(0);
    expect(runGit(source, ['commit', '-qm', 'chore: initialize']).code).toBe(0);
    const base = runGitStep(source, ['rev-parse', 'HEAD']);
    await writeFile(join(source, 'source.sh'), 'echo selected\n');
    expect(runGit(source, ['commit', '-qam', 'feat: select source']).code).toBe(0);
    const selected = runGitStep(source, ['rev-parse', 'HEAD']);
    expect(runGit(sandbox.path, ['clone', '--depth=1', pathToFileURL(source).href, 'checkout']).code).toBe(0);
    const checkout = join(sandbox.path, 'checkout');
    const command = ['check', '--hook', 'pre-push', '--json', '--only'];
    const remote = ['--', 'unseen', 'unused'];
    const input = { stdin: `refs/heads/main ${selected} refs/heads/main ${'0'.repeat(selected.length)}\n` };
    expect(runGit(checkout, ['remote', 'add', 'unseen', pathToFileURL(source).href]).code).toBe(0);
    await installGeneratedTools(checkout);
    const content = await spawnGspot(checkout, [...command, 'project/bash-syntax', ...remote], {}, input);
    expect(content.code, content.stdout + content.stderr).toBe(0);
    expect((JSON.parse(content.stdout) as PushReport).revisions[0]).toMatchObject({
        historyComplete: false,
        report: { checks: [{ status: 'passed' }] },
    });
    const refused = await spawnGspot(checkout, [...command, 'commits/commitlint-pushed', ...remote], {}, input);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toMatch(
        /Pushed history is incomplete for commits\/commitlint-pushed[\s\S]*git fetch --unshallow/u,
    );
    expect(runGit(checkout, ['fetch', '--unshallow']).code).toBe(0);
    const completed = await spawnGspot(checkout, [...command, 'commits/commitlint-pushed', ...remote], {}, input);
    expect(completed.code, completed.stdout + completed.stderr).toBe(0);

    const report = JSON.parse(completed.stdout) as PushReport;
    expect({
        historyComplete: report.revisions[0]?.historyComplete,
        checks: report.revisions[0]?.report.checks.map(({ status }) => ({ status })),
        commits: new Set(report.revisions[0]?.commits),
    }).toStrictEqual({
        historyComplete: true,
        checks: [{ status: 'passed' }],
        commits: new Set([base, selected]),
    });

    expect({
        head: runGitStep(checkout, ['rev-parse', 'HEAD']),
        source: await readFile(join(checkout, 'source.sh'), 'utf8'),
    }).toStrictEqual({ head: selected, source: 'echo selected\n' });
});
// Root ignores the read-only permission bits that provoke the write failure.
test.skipIf(isWindows || process.getuid?.() === 0)(
    `a SQLFluff fix that cannot write its file is a failed fix with exit code 2, even though SQLFluff's exit code also means findings`,
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['sql'], {
                level: 'all',
                tables: '[tools.sqlfluff]\ndialect = "postgres"\n',
            }),
            'source/sample.sql': 'select  * from foo;\n',
        });

        await installGeneratedTools(sandbox.path);
        const command = ['check', '--only', 'sql/sqlfluff', '--fix', '--json'];
        await chmod(join(sandbox.path, 'source'), 0o500);
        try {
            const failedCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
            const failed = failedCommand.report;
            expect(failed.exitCode).toBe(2);
            expect(failed.fixes?.results).toMatchObject([
                {
                    check: 'sql/sqlfluff',
                    status: 'failed',
                    changed: [],
                    note: expect.stringContaining('PermissionError') as string,
                },
            ]);
            expect(await readFile(join(sandbox.path, 'source/sample.sql'), 'utf8')).toBe('select  * from foo;\n');
        } finally {
            await chmod(join(sandbox.path, 'source'), 0o700);
        }
    },
);
test.each([...PARTIAL_FIX_CASES])(
    '$check fixes findings, reports an unchanged second fix, and passes after a manual fix',
    async ({ configuration, check, path, tables, sample, partial, corrected }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([configuration], { level: 'all', tables }),
            '.gitignore': '.gspot/\n',
            [path]: sample,
        });

        await installGeneratedTools(sandbox.path);
        const command = ['check', '--only', check, '--fix', '--json'];
        const failedCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
        const failed = failedCommand.report;
        expect(failed.exitCode, JSON.stringify({ report: failed, fixes: failed.fixes })).toBe(1);
        expect(failed.fixes?.results).toMatchObject([{ check, status: 'changed', changed: [path] }]);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(partial);
        const repeatedCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
        const repeated = repeatedCommand.report;
        expect(repeated.exitCode).toBe(1);
        expect(repeated.fixes?.results).toMatchObject([{ check, status: 'unchanged', changed: [] }]);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(partial);
        await writeFile(join(sandbox.path, path), corrected);
        const passedCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
        const passed = passedCommand.report;
        expect(passed.exitCode, JSON.stringify(passed)).toBe(0);
    },
);
test('typos marks a finding that its fixer cannot fix as not fixable', async () => {
    const { configuration, check, path, tables, sample } = PARTIAL_FIX_CASES.find(
        (entry) => entry.check === 'spelling/typos',
    )!;
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([configuration], { level: 'all', tables }),
        '.gitignore': '.gspot/\n',
        [path]: sample,
    });
    await installGeneratedTools(sandbox.path);
    const fixed = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', check, '--fix', '--json']));
    expect(
        fixed.report.checks.flatMap(({ findings }) => findings).map(({ file, fixable }) => ({ file, fixable })),
    ).toStrictEqual([{ file: path, fixable: false }]);
});

test('shfmt reports and fixes script formatting with tabs', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash', 'format'], TAB_FORMAT_SETTINGS),
        'example.sh': `if true; then
  echo ready
fi
`,
    });

    await installGeneratedTools(sandbox.path);
    const command = ['check', '--only', 'bash/shfmt', '--json'];
    const brokenCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
    const broken = brokenCommand.report;
    expect(broken.exitCode, JSON.stringify(broken)).toBe(1);
    const correctionCommand = parseCheckReport(await spawnGspot(sandbox.path, [...command, '--fix']));
    const correction = correctionCommand.report;
    expect(correction.exitCode, JSON.stringify(correction)).toBe(0);
    const indent = '\t';
    expect(await readFile(join(sandbox.path, 'example.sh'), 'utf8')).toBe(`if true; then
${indent}echo ready
fi
`);
    const verifiedCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
    const verified = verifiedCommand.report;
    expect(verified.exitCode, JSON.stringify(verified)).toBe(0);
});
