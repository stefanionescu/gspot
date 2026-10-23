import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/runs/command.ts';
import { findFileTarget } from '#tests/setup/cli/config-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { testdir, createFileTree, type TestdirResult } from 'testdirs';
import { rmSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { STAGED_PACKAGE_JSON } from '#tests/config/commands/check/staged.ts';
import { stat, chmod, mkdir, unlink, readFile, writeFile } from 'node:fs/promises';

/** Create two index entries that differ only by letter case. */
async function createCaseClashingSandbox(): Promise<TestdirResult> {
    const sandbox = await testdir();
    try {
        const check = {
            command: [
                process.execPath,
                '-e',
                'console.log(JSON.stringify(process.argv.slice(1).map(file => ({file,message:require("node:fs").readFileSync(file,"utf8")})))); process.exitCode = 1;',
                '{files}',
            ],
            output: { format: 'json', fields: { file: 'file', message: 'message' } },
            paths: ['docs/**'],
            stage: 'commit',
        };
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings([], {
                tables: stringify({ command_check: [{ id: 'sandbox/report', ...check }] }),
            }),
            'docs/guide.md': '# Guide\n',
        });
        runGitStep(sandbox.path, ['init', '-q']);
        runGitStep(sandbox.path, ['add', '-A']);
        runGitStep(sandbox.path, ['commit', '-qm', 'base']);
        for (const [path, text] of [
            ['docs/Notes.md', '# Notes\n'],
            ['docs/NOTES.md', '# NOTES\n'],
        ]) {
            await writeFile(join(sandbox.path, '.git', 'staged-blob'), text!);
            const hash = runGitStep(sandbox.path, ['hash-object', '-w', '.git/staged-blob']);
            runGitStep(sandbox.path, ['update-index', '--add', '--cacheinfo', `100644,${hash},${path!}`]);
        }
        return sandbox;
    } catch (error) {
        await sandbox[Symbol.asyncDispose]();
        throw error;
    }
}

test('a staged check reads index bytes and file modes, converts no line endings, and writes nothing into the working tree', async () => {
    await using sandbox = await testdir();
    const command = [
        process.execPath,
        '-e',
        `
        import { statSync } from 'node:fs';
        const bytes = Buffer.from(await Bun.file('payload.dat').arrayBuffer());
        await Bun.write('created.txt', 'snapshot output');
        // Windows file systems keep no executable bit to compare.
        const isExecutable = ${String(isWindows)} || (statSync('task.sh').mode & 0o111) !== 0;
        process.exit(bytes.equals(Buffer.from([255, 10, 0])) && isExecutable ? 0 : 1);
    `,
    ];
    await createFileTree(sandbox.path, {
        '.gitattributes': 'payload.dat text eol=crlf\n',
        'payload.dat': Buffer.from([255, 10, 0]),
        'task.sh': '#!/bin/sh\nexit 0\n',
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [
                    { id: 'project/index-bytes', command, paths: ['payload.dat', 'task.sh'], stage: 'commit' },
                ],
            }),
        }),
    });
    await chmod(join(sandbox.path, 'task.sh'), 0o755);
    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, ['add', '-A']);
    await writeFile(join(sandbox.path, 'payload.dat'), Buffer.from([0, 1, 2]));
    await chmod(join(sandbox.path, 'task.sh'), 0o644);
    const result = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--staged', '--only', 'project/index-bytes', '--json']),
    );
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.report.checks[0]?.status).toBe('passed');
    expect(await readFile(join(sandbox.path, 'payload.dat'))).toStrictEqual(Buffer.from([0, 1, 2]));
    const attributes = await stat(join(sandbox.path, 'task.sh'));
    expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o644 }));
    expect(await isOnDisk(join(sandbox.path, 'created.txt'))).toBe(false);
});

test('a staged check copies the locked dependencies and leaves the working tree as it was', async () => {
    await using sandbox = await testdir();
    const lockfile = JSON.stringify({
        name: STAGED_PACKAGE_JSON.name,
        lockfileVersion: 3,
        packages: { '': STAGED_PACKAGE_JSON, 'node_modules/dependency': { version: '1.0.0' } },
    });
    const command = [
        process.execPath,
        '-e',
        `
        import { verdict } from 'dependency';
        await Bun.write('node_modules/dependency/stamp.txt', 'snapshot output');
        process.exit(verdict ? 0 : 1);
    `,
    ];
    await createFileTree(sandbox.path, {
        '.gitignore': `${DOT_GSPOT}/\nnode_modules/\n`,
        'package.json': JSON.stringify(STAGED_PACKAGE_JSON),
        'package-lock.json': lockfile,
        'node_modules/dependency/package.json':
            '{"name":"dependency","version":"1.0.0","type":"module","exports":"./index.js"}',
        'node_modules/dependency/index.js': 'export const verdict = true;\n',
        'node_modules/dependency/stamp.txt': 'authored dependency data',
        'source.txt': 'authored input',
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [{ id: 'project/dependencies', command, paths: ['source.txt'], stage: 'commit' }],
            }),
        }),
    });
    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, ['add', '-A']);
    const commandArguments = ['check', '--staged', '--only', 'project/dependencies', '--json'];
    const first = await runGspot(sandbox.path, commandArguments);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'node_modules/dependency/stamp.txt'), 'utf8')).toBe(
        'authored dependency data',
    );
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('authored input');
});

test('a staged check keeps the generated basedpyright.json of each Python scope and refuses an unstaged pyproject.toml change', async () => {
    await using sandbox = await testdir();
    const project = '[project]\nname = "example"\nversion = "0.0.0"\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            scopes: [{ path: 'child', configurations: ['python'] }],
        }),
        'pyproject.toml': project,
        'main.py': 'value = 1\n',
        'child/pyproject.toml': project,
        'child/main.py': 'value = 2\n',
    });
    for (const scope of ['', 'child']) await mkdir(join(sandbox.path, scope, '.venv'));
    runGitStep(sandbox.path, ['init', '-q']);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    runGitStep(sandbox.path, ['add', '-A']);
    const original = await readFile(join(sandbox.path, findFileTarget('python', 'basedpyright.json')));
    const commandArguments = ['check', '--staged', '--only', 'gspot/generated-files', '--json'];
    const checked = parseCheckReport(await runGspot(sandbox.path, commandArguments));
    // gspot install writes the lockfiles, and unit tests do not install.
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(
        checked.report.checks.flatMap((check) => check.findings).map(({ file, rule }) => ({ file, rule })),
    ).toStrictEqual([
        { file: `${DOT_GSPOT}/package-lock.json`, rule: 'missing' },
        { file: GSPOT_PATHS.uvLockfile, rule: 'missing' },
    ]);
    expect(await readFile(join(sandbox.path, findFileTarget('python', 'basedpyright.json')))).toStrictEqual(original);
    await writeFile(join(sandbox.path, 'child/pyproject.toml'), project + '# Unstaged project change.\n');
    const refused = await runGspot(sandbox.path, commandArguments);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(JSON.parse(refused.stdout) as CommandFailureJson).toStrictEqual({
        error: 'copy',
        message:
            'Installed dependencies do not match the dependency files and lockfiles of the revision or its compiler configurations. Check this commit in its own clone after installing its project dependencies and running gspot install there.',
    });
    expect(await readFile(join(sandbox.path, findFileTarget('python', 'basedpyright.json')))).toStrictEqual(original);
});

test.skipIf(isCaseFolding())('staged paths that differ only by letter case keep both spellings and bytes', async () => {
    await using sandbox = await createCaseClashingSandbox();
    const result = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--staged', '--only', 'sandbox/report', '--json']),
    );
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const { report } = result;
    expect(report.checks.map((each) => [each.check, each.status, each.fileCount])).toStrictEqual([
        ['sandbox/report', 'failed', 2],
    ]);
    expect(
        Object.fromEntries(
            report.checks.flatMap(({ findings }) => findings.map(({ file, message }) => [file, message])),
        ),
    ).toStrictEqual({ 'docs/Notes.md': '# Notes\n', 'docs/NOTES.md': '# NOTES\n' });
});

test.skipIf(!isCaseFolding())(
    'staged paths that differ only by letter case are refused on a case-folding disk',
    async () => {
        await using sandbox = await createCaseClashingSandbox();
        const result = parseCheckReport(
            await runGspot(sandbox.path, ['check', '--staged', '--only', 'sandbox/report', '--json']),
        );
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(JSON.parse(result.stdout) as CommandFailureJson).toStrictEqual({
            error: 'copy',
            message:
                'Git holds docs/NOTES.md and docs/Notes.md, which differ only by letter case, and this file system keeps one of them. Rename or remove one with git mv or git rm --cached, then check again.',
        });
    },
);

test('staged checks use index bytes and settings on an unborn branch while preserving unstaged edits', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK });
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'script with spaces.sh': 'if then\n' });
    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, ['add', '-A']);
    const index = runGitStep(sandbox.path, ['ls-files', '--stage', '-z']);
    await writeFile(join(sandbox.path, 'script with spaces.sh'), 'echo repaired only in the working tree\n');
    await writeFile(join(sandbox.path, 'gspot.toml'), 'invalid working settings');
    const commandArguments = ['check', '--staged', '--only', 'project/bash-syntax', '--json'];
    const failed = parseCheckReport(await runGspot(sandbox.path, commandArguments));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const failedReport = failed.report;
    expect(failedReport.comparison?.content).toBe('index');
    expect(failedReport.checks).toMatchObject([
        {
            reproduce: 'gspot check --only project/bash-syntax --staged',
            findings: [
                { file: 'script with spaces.sh', line: 1, message: "syntax error near unexpected token `then'" },
                { file: 'script with spaces.sh', line: 1, message: "`if then'" },
            ],
        },
    ]);
    expect(runGitStep(sandbox.path, ['ls-files', '--stage', '-z'])).toBe(index);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe('invalid working settings');
    expect(await readFile(join(sandbox.path, 'script with spaces.sh'), 'utf8')).toBe(
        'echo repaired only in the working tree\n',
    );
    await writeFile(join(sandbox.path, 'gspot.toml'), settings);
    runGitStep(sandbox.path, ['add', 'gspot.toml', 'script with spaces.sh']);
    await writeFile(join(sandbox.path, 'script with spaces.sh'), 'if then\n');
    const passed = parseCheckReport(await runGspot(sandbox.path, commandArguments));
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect(passed.report.checks[0]?.status).toBe('passed');
    expect(passed.report.comparison?.reference).not.toBe(failedReport.comparison?.reference);
    expect(await readFile(join(sandbox.path, 'script with spaces.sh'), 'utf8')).toBe('if then\n');
});

test('staged checks read an indexed file when its working file is missing', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'script with spaces.sh': 'echo indexed\n',
    });

    runGitStep(sandbox.path, ['init', '-q']);
    runGitStep(sandbox.path, ['add', '-A']);
    const commandArguments = ['check', '--staged', '--only', 'project/bash-syntax', '--json'];
    await unlink(join(sandbox.path, 'script with spaces.sh'));
    const ran = parseCheckReport(await runGspot(sandbox.path, commandArguments));
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(ran.report.checks[0]).toMatchObject({ status: 'passed', fileCount: 1 });
    expect(await isOnDisk(join(sandbox.path, 'script with spaces.sh'))).toBe(false);
});

/** Check whether this system treats differently cased path names as the same file. */
function isCaseFolding(): boolean {
    const root = mkdtempSync(join(tmpdir(), 'gspot-case-'));
    try {
        writeFileSync(join(root, 'case-probe'), 'Probe.');
        return existsSync(join(root, 'CASE-PROBE'));
    } finally {
        rmSync(root, { recursive: true });
    }
}
