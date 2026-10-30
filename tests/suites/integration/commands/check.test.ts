import { test, expect } from 'bun:test';
import { pathToFileURL } from 'node:url';
import { getTool } from '#cli/manifests/tools.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { join, dirname, delimiter } from 'node:path';
import { GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/bash.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { type PushReport } from '#cli/types/commands/check.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/setup/sandboxes.ts';
import { MISE_INSTALL_URL } from '#cli/config/executables/inspect.ts';
import { chmod, symlink, readFile, writeFile } from 'node:fs/promises';
import { PARTIAL_FIX_CASES } from '#tests/config/integration/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { spawnGspot, applyThenInstall, parseCheckReport } from '#tests/setup/cli/commands.ts';

test('bash/shellcheck without ShellCheck on PATH exits 2 and names the pinned version, while bash/function-size passes and bash/shellcheck passes on the full PATH', async () => {
    await using sandbox = await createGitSandbox({
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
    if (!isWindows) await symlink(gitPath!, join(bin, 'git'));
    const path = isWindows ? `${bin}${delimiter}${dirname(gitPath!)}` : bin;
    const environment = {
        PATH: path,
        HOME: join(sandbox.path, 'home'),
        MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
    };
    const initialized = await spawnGspot(sandbox.path, ['init', '--yes', '--configurations', 'bash'], environment);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(initialized.stdout.split('\n')).toContain(
        'Next: run gspot install to install the tools and turn on the Git hooks.',
    );
    const check = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json'], environment),
    );
    expect(check.code, check.stdout + check.stderr).toBe(2);
    const version = String(getTool(readConfigurations().values().toArray(), 'shellcheck').version);
    expect(check.report.checks).toMatchObject([
        {
            check: 'bash/shellcheck',
            status: 'missing',
            findings: [],
            note: `shellcheck ${version} is not installed. Install mise (${MISE_INSTALL_URL}), or install shellcheck ${version} yourself.`,
        },
    ]);
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
    runGitStep(source, ['init', '-q']);
    await applyThenInstall(source);
    runGitStep(source, ['add', '-A']);
    runGitStep(source, ['commit', '-qm', 'chore: initialize']);
    const base = runGitStep(source, ['rev-parse', 'HEAD']);
    await writeFile(join(source, 'source.sh'), 'echo selected\n');
    runGitStep(source, ['commit', '-qam', 'feat: select source']);
    const selected = runGitStep(source, ['rev-parse', 'HEAD']);
    runGitStep(sandbox.path, ['clone', '--depth=1', pathToFileURL(source).href, 'checkout']);
    const checkout = join(sandbox.path, 'checkout');
    const command = ['check', '--hook', 'pre-push', '--json', '--only'];
    const remote = ['--', 'unseen', 'unused'];
    const input = { stdin: `refs/heads/main ${selected} refs/heads/main ${'0'.repeat(selected.length)}\n` };
    runGitStep(checkout, ['remote', 'add', 'unseen', pathToFileURL(source).href]);
    await applyThenInstall(checkout);
    const content = await spawnGspot(checkout, [...command, 'project/bash-syntax', ...remote], {}, input);
    expect(content.code, content.stdout + content.stderr).toBe(0);
    expect((JSON.parse(content.stdout) as PushReport).revisions[0]).toMatchObject({
        shallow: true,
        report: { checks: [{ status: 'passed' }] },
    });
    const refused = await spawnGspot(checkout, [...command, 'commits/commitlint-pushed', ...remote], {}, input);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toBe(
        'Pushed history is incomplete for commits/commitlint-pushed. Run git fetch --unshallow and retry.',
    );
    runGitStep(checkout, ['fetch', '--unshallow']);
    const pushed = await spawnGspot(checkout, [...command, 'commits/commitlint-pushed', ...remote], {}, input);
    expect(pushed.code, pushed.stdout + pushed.stderr).toBe(0);
    const report = JSON.parse(pushed.stdout) as PushReport;
    expect({
        shallow: report.revisions[0]?.shallow,
        checks: report.revisions[0]?.report.checks.map(({ status }) => ({ status })),
        commits: new Set(report.revisions[0]?.commits),
    }).toStrictEqual({
        shallow: false,
        checks: [{ status: 'passed' }],
        commits: new Set([base, selected]),
    });
    expect({
        head: runGitStep(checkout, ['rev-parse', 'HEAD']),
        source: await readFile(join(checkout, 'source.sh'), 'utf8'),
    }).toStrictEqual({ head: selected, source: 'echo selected\n' });
});

test.skipIf(isWindows || process.getuid?.() === 0)(
    `a SQLFluff fix that cannot write its file is a failed fix with exit code 2, even though SQLFluff's exit code also means findings`,
    async () => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['sql'], {
                level: 'all',
                tables: stringify({ tools: { sqlfluff: { dialect: 'postgres' } } }),
            }),
            'source/sample.sql': 'select  * from foo;\n',
        });

        await applyThenInstall(sandbox.path);
        const command = ['check', '--only', 'sql/sqlfluff', '--fix', '--json'];
        await chmod(join(sandbox.path, 'source'), 0o500);
        try {
            const failed = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
            expect(failed.exitCode, JSON.stringify(failed)).toBe(2);
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
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([configuration], { level: 'all', tables }),
            '.gitignore': `${GSPOT_FOLDER}/\n`,
            [path]: sample,
        });

        await applyThenInstall(sandbox.path);
        const command = ['check', '--only', check, '--fix', '--json'];
        const failed = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
        expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
        expect(failed.fixes?.results).toMatchObject([{ check, status: 'changed', changed: [path] }]);
        expect(
            failed.checks.flatMap(({ findings }) => findings).map(({ file, fixable }) => ({ file, fixable })),
        ).toStrictEqual([{ file: path, fixable: false }]);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(partial);
        const repeated = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
        expect(repeated.exitCode, JSON.stringify(repeated)).toBe(1);
        expect(repeated.fixes?.results).toMatchObject([{ check, status: 'unchanged', changed: [] }]);
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(partial);
        await writeFile(join(sandbox.path, path), corrected);
        const passed = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
        expect(passed.exitCode, JSON.stringify(passed)).toBe(0);
    },
);
