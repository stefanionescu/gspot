import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { stringify } from '@decimalturn/toml-patch';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { BROKEN_IF_SCRIPT } from '#tests/config/bash.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { NOTES_MARKDOWN } from '#tests/config/documents.ts';
import { createFileTree, type TestdirResult } from 'testdirs';
import { normalizeFileMode } from '#cli/system/files/bounded.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { DEPENDENCY_FILES_MESSAGE } from '#tests/config/messages.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/setup/sandboxes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { rmSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { stat, chmod, mkdir, unlink, readFile, writeFile } from 'node:fs/promises';
import { SCRIPT_SPACES, STAGED_PACKAGE_JSON, UPPERCASE_NOTES_MARKDOWN } from '#tests/config/commands/check/staged.ts';

async function createCaseClashingSandbox(): Promise<TestdirResult> {
    const sandbox = await createGitSandbox({});
    try {
        const check = {
            command: buildProgramCommand('checks/contents', '{files}'),
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
        runGitStep(sandbox.path, ['add', '-A']);
        runGitStep(sandbox.path, ['commit', '-qm', 'base']);
        for (const [path, text] of [
            ['docs/Notes.md', NOTES_MARKDOWN],
            ['docs/NOTES.md', UPPERCASE_NOTES_MARKDOWN],
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
    await using sandbox = await createGitSandbox({});
    const command = buildProgramCommand(
        'checks/staged',
        '--file',
        'payload.dat',
        '--bytes',
        'ff0a00',
        '--executable',
        'task.sh',
        '--write',
        '{root}/created.txt=snapshot output',
    );
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
    runGitStep(sandbox.path, ['add', '-A']);
    await writeFile(join(sandbox.path, 'payload.dat'), Buffer.from([0, 1, 2]));
    await chmod(join(sandbox.path, 'task.sh'), 0o644);
    const result = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--staged', '--only', 'project/index-bytes', '--json']),
    );
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.report.checks[0]?.status).toBe('passed');
    expect(result.report.checks[0]?.command).toStrictEqual(
        command.map((argument) => argument.replace('{root}', sandbox.path)),
    );
    expect(await readFile(join(sandbox.path, 'payload.dat'))).toStrictEqual(Buffer.from([0, 1, 2]));
    const attributes = await stat(join(sandbox.path, 'task.sh'));
    expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o644 }));
    expect(await isOnDisk(join(sandbox.path, 'created.txt'))).toBe(false);
});

test('a staged check reuses the locked dependencies and isolates source edits', async () => {
    await using sandbox = await createGitSandbox({});
    const lockfile = JSON.stringify({
        name: STAGED_PACKAGE_JSON.name,
        lockfileVersion: 3,
        packages: { '': STAGED_PACKAGE_JSON, 'node_modules/dependency': { version: '1.0.0' } },
    });
    const command = buildProgramCommand(
        'checks/dependency',
        '--name',
        'dependency',
        '--write',
        'source.txt=snapshot output',
    );
    await createFileTree(sandbox.path, {
        '.gitignore': `${GSPOT_FOLDER}/\nnode_modules/\n`,
        'package.json': JSON.stringify(STAGED_PACKAGE_JSON),
        'package-lock.json': lockfile,
        'node_modules/dependency/package.json':
            '{"name":"dependency","version":"1.0.0","type":"module","exports":"./index.js"}',
        'node_modules/dependency/index.js': 'export const isPassing = true;\n',
        'node_modules/dependency/stamp.txt': 'authored dependency data',
        'source.txt': 'authored input',
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [{ id: 'project/dependencies', command, paths: ['source.txt'], stage: 'commit' }],
            }),
        }),
    });
    runGitStep(sandbox.path, ['add', '-A']);
    const commandArguments = ['check', '--staged', '--only', 'project/dependencies', '--json'];
    const first = await runGspot(sandbox.path, commandArguments);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'node_modules/dependency/stamp.txt'), 'utf8')).toBe(
        'authored dependency data',
    );
    expect(await readFile(join(sandbox.path, 'source.txt'), 'utf8')).toBe('authored input');
});

test('a staged check keeps each Python scope config and reports the installed dependency note for an unstaged pyproject.toml change', async () => {
    await using sandbox = await createGitSandbox({});
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
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    runGitStep(sandbox.path, ['add', '-A']);
    const previous = await readFile(join(sandbox.path, getManifestTarget('python', 'basedpyright.json')));
    const commandArguments = ['check', '--staged', '--only', 'gspot/generated-files', '--json'];
    const checked = parseCheckReport(await runGspot(sandbox.path, commandArguments));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(
        checked.report.checks.flatMap((check) => check.findings).map(({ file, rule }) => ({ file, rule })),
    ).toStrictEqual([
        { file: GSPOT_PATHS.miseLockfile, rule: 'missing' },
        { file: `${GSPOT_FOLDER}/package-lock.json`, rule: 'missing' },
        { file: GSPOT_PATHS.uvLockfile, rule: 'missing' },
    ]);
    const contents = await readFile(join(sandbox.path, getManifestTarget('python', 'basedpyright.json')));
    expect(contents).toStrictEqual(previous);
    await writeFile(join(sandbox.path, 'child/pyproject.toml'), project + '# Unstaged project change.\n');
    const rerun = parseCheckReport(await runGspot(sandbox.path, commandArguments));
    expect(rerun.code, rerun.stdout + rerun.stderr).toBe(1);
    expect(rerun.report.notes).toStrictEqual([DEPENDENCY_FILES_MESSAGE]);
    expect(rerun.report.checks.flatMap((check) => check.findings)).toStrictEqual(
        checked.report.checks.flatMap((check) => check.findings),
    );
    const compilerSettings = await readFile(join(sandbox.path, getManifestTarget('python', 'basedpyright.json')));
    expect(compilerSettings).toStrictEqual(previous);
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
    ).toStrictEqual({ 'docs/Notes.md': NOTES_MARKDOWN, 'docs/NOTES.md': UPPERCASE_NOTES_MARKDOWN });
});

test.skipIf(!isCaseFolding())(
    'staged paths that differ only by letter case are refused on a case-folding disk',
    async () => {
        await using sandbox = await createCaseClashingSandbox();
        const result = parseCheckReport(
            await runGspot(sandbox.path, ['check', '--staged', '--only', 'sandbox/report', '--json']),
        );
        expect(result.code, result.stdout + result.stderr).toBe(2);
        expect(JSON.parse(result.stdout)).toStrictEqual({
            version: cliPackage.version,
            exitCode: 2,
            notes: [],
            error: 'copy',
            message:
                'Git holds docs/NOTES.md and docs/Notes.md, which differ only by letter case, and this file system keeps one of them. Rename or remove one with git mv or git rm --cached, then check again.',
        });
    },
);

test('staged checks use index bytes and settings on an unborn branch while preserving unstaged edits', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK });
    await createFileTree(sandbox.path, { 'gspot.toml': settings, 'script with spaces.sh': BROKEN_IF_SCRIPT });
    runGitStep(sandbox.path, ['add', '-A']);
    const index = runGitStep(sandbox.path, ['ls-files', '--stage', '-z']);
    await writeFile(join(sandbox.path, SCRIPT_SPACES), 'echo repaired only in the working tree\n');
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
                { file: SCRIPT_SPACES, line: 1, message: "syntax error near unexpected token `then'" },
                { file: SCRIPT_SPACES, line: 1, message: "`if then'" },
            ],
        },
    ]);
    expect(runGitStep(sandbox.path, ['ls-files', '--stage', '-z'])).toBe(index);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe('invalid working settings');
    expect(await readFile(join(sandbox.path, SCRIPT_SPACES), 'utf8')).toBe('echo repaired only in the working tree\n');
    await writeFile(join(sandbox.path, 'gspot.toml'), settings);
    runGitStep(sandbox.path, ['add', 'gspot.toml', SCRIPT_SPACES]);
    await writeFile(join(sandbox.path, SCRIPT_SPACES), BROKEN_IF_SCRIPT);
    const passed = parseCheckReport(await runGspot(sandbox.path, commandArguments));
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect(passed.report.checks[0]?.status).toBe('passed');
    expect(passed.report.comparison?.reference).not.toBe(failedReport.comparison?.reference);
    expect(await readFile(join(sandbox.path, SCRIPT_SPACES), 'utf8')).toBe(BROKEN_IF_SCRIPT);
});

test('staged checks read an indexed file when its working file is missing', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'script with spaces.sh': 'echo indexed\n',
    });

    runGitStep(sandbox.path, ['add', '-A']);
    const commandArguments = ['check', '--staged', '--only', 'project/bash-syntax', '--json'];
    await unlink(join(sandbox.path, SCRIPT_SPACES));
    const ran = parseCheckReport(await runGspot(sandbox.path, commandArguments));
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(ran.report.checks[0]).toMatchObject({ status: 'passed', fileCount: 1 });
    expect(await isOnDisk(join(sandbox.path, SCRIPT_SPACES))).toBe(false);
});

test('a staged check reads the pushed commits of the repository, not of the index copy', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([], { level: 'all' }) });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    runGitStep(sandbox.path, ['add', '-A']);
    runGitStep(sandbox.path, ['commit', '-qm', 'chore: start']);
    await writeFile(join(sandbox.path, 'notes.md'), NOTES_MARKDOWN);
    runGitStep(sandbox.path, ['add', '-A']);
    runGitStep(sandbox.path, ['commit', '-qm', 'Pushed already']);
    runGitStep(sandbox.path, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    runGitStep(sandbox.path, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);
    await writeFile(join(sandbox.path, 'notes.md'), '# Staged notes\n');
    runGitStep(sandbox.path, ['add', '-A']);
    const commandArguments = ['check', '--staged', '--only', 'commits/commitlint-pushed', '--json'];
    const result = parseCheckReport(await runGspot(sandbox.path, commandArguments));
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.report.checks[0]).toMatchObject({ status: 'passed', note: 'Checked 0 commit messages.' });
});

function isCaseFolding(): boolean {
    const root = mkdtempSync(join(tmpdir(), 'gspot-case-'));
    try {
        writeFileSync(join(root, 'case-probe'), 'Probe.');
        return existsSync(join(root, 'CASE-PROBE'));
    } finally {
        rmSync(root, { recursive: true });
    }
}
