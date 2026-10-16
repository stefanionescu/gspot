import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { readGitOutput } from '#tests/setup/git.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { generate } from '#cli/generation/generate.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { isWindows, isCaseFolding } from '#tests/setup/system.ts';
import { BASH_SYNTAX_CHECK } from '#tests/data/checks/bash/tool-checks.ts';
import { stat, chmod, mkdir, unlink, readFile, writeFile } from 'node:fs/promises';

test('a staged check reads index bytes and file modes, converts no line endings, and writes nothing into the working tree', async () => {
    await using folder = await testdir();
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
    await createFileTree(folder.path, {
        '.gitattributes': 'payload.dat text eol=crlf\n',
        'payload.dat': Buffer.from([255, 10, 0]),
        'task.sh': '#!/bin/sh\nexit 0\n',
        'gspot.toml': `configurations = []
[[command_check]]
name = "project/index-bytes"
command = ${JSON.stringify(command)}
paths = ["payload.dat", "task.sh"]
stage = "commit"
`,
    });
    await chmod(join(folder.path, 'task.sh'), 0o755);
    readGitOutput(folder.path, ['init', '-q']);
    readGitOutput(folder.path, ['add', '-A']);
    await writeFile(join(folder.path, 'payload.dat'), Buffer.from([0, 1, 2]));
    await chmod(join(folder.path, 'task.sh'), 0o644);
    const result = await checkReport(folder.path, ['check', '--staged', '--only', 'project/index-bytes', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.report.checks[0]?.status).toBe('passed');
    expect(await readFile(join(folder.path, 'payload.dat'))).toStrictEqual(Buffer.from([0, 1, 2]));
    const attributes = await stat(join(folder.path, 'task.sh'));
    expect(attributes.mode & 0o777).toBe(normalizeFileMode({ mode: 0o644 }));
    expect(await isOnDisk(join(folder.path, 'created.txt'))).toBe(false);
});

test('a staged check copies the locked dependencies and leaves the working tree as it was', async () => {
    await using folder = await testdir();
    const manifest = { name: 'snapshot-project', private: true, type: 'module', dependencies: { dependency: '1.0.0' } };
    const lockfile = JSON.stringify({
        name: manifest.name,
        lockfileVersion: 3,
        packages: { '': manifest, 'node_modules/dependency': { version: '1.0.0' } },
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
    await createFileTree(folder.path, {
        '.gitignore': '.gspot/\nnode_modules/\n',
        'package.json': JSON.stringify(manifest),
        'package-lock.json': lockfile,
        'node_modules/dependency/package.json':
            '{"name":"dependency","version":"1.0.0","type":"module","exports":"./index.js"}',
        'node_modules/dependency/index.js': 'export const verdict = true;\n',
        'node_modules/dependency/stamp.txt': 'authored dependency data',
        'source.txt': 'authored input',
        'gspot.toml': `configurations = []
[[command_check]]
name = "project/dependencies"
command = ${JSON.stringify(command)}
paths = ["source.txt"]
stage = "commit"
`,
    });
    readGitOutput(folder.path, ['init', '-q']);
    readGitOutput(folder.path, ['add', '-A']);
    const commandArguments = ['check', '--staged', '--only', 'project/dependencies', '--json'];
    const first = await runGspot(folder.path, commandArguments);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect(await readFile(join(folder.path, 'node_modules/dependency/stamp.txt'), 'utf8')).toBe(
        'authored dependency data',
    );
    expect(await readFile(join(folder.path, 'source.txt'), 'utf8')).toBe('authored input');
});

test('a staged check keeps the matching Python tool environments and refuses unstaged project changes', async () => {
    await using sandbox = await testdir();
    const project = `[project]
name = "example"
version = "0.0.0"
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['python'], {
            level: 'all',
            tables: `[[scope]]
path = "child"
configurations = ["python"]
`,
        }),
        'pyproject.toml': project,
        'main.py': 'value = 1\n',
        'child/pyproject.toml': project,
        'child/main.py': 'value = 2\n',
    });
    for (const scope of ['', 'child']) await mkdir(join(sandbox.path, scope, '.venv'));
    const session = await openSession(sandbox.path);
    using log = openWriter(sandbox.path);
    writeGeneratedFiles(session, generate(session), log);
    readGitOutput(sandbox.path, ['init', '-q']);
    readGitOutput(sandbox.path, ['add', '-A']);
    const original = await readFile(join(sandbox.path, '.gspot/config/basedpyrightconfig.json'));
    const commandArguments = ['check', '--staged', '--only', 'gspot/generated-files', '--json'];
    const checked = await checkReport(sandbox.path, commandArguments);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(
        checked.report.checks
            .flatMap((check) => check.findings)
            .filter((finding) => finding.file.endsWith('/basedpyrightconfig.json')),
    ).toStrictEqual([]);
    expect(await readFile(join(sandbox.path, '.gspot/config/basedpyrightconfig.json'))).toEqual(original);
    await writeFile(join(sandbox.path, 'child/pyproject.toml'), project + '# Unstaged project change.\n');
    const refused = await runGspot(sandbox.path, commandArguments);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain(
        'do not match the revision manifests and lockfiles',
    );
    expect(await readFile(join(sandbox.path, '.gspot/config/basedpyrightconfig.json'))).toEqual(original);
});

/** Create two index entries that differ only by letter case. */
async function createCaseClashingSandbox() {
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
            'gspot.toml': stringify({
                configurations: [],
                rules: { enabled: false },
                command_check: [{ name: 'sandbox/report', ...check }],
            }),
            'docs/guide.md': '# Guide\n',
        });
        readGitOutput(sandbox.path, ['init', '-q']);
        readGitOutput(sandbox.path, ['add', '-A']);
        readGitOutput(sandbox.path, ['commit', '-qm', 'base']);
        for (const [path, text] of [
            ['docs/Notes.md', '# Notes\n'],
            ['docs/NOTES.md', '# NOTES\n'],
        ]) {
            await writeFile(join(sandbox.path, '.git', 'staged-blob'), text!);
            const hash = readGitOutput(sandbox.path, ['hash-object', '-w', '.git/staged-blob']);
            readGitOutput(sandbox.path, ['update-index', '--add', '--cacheinfo', `100644,${hash},${path!}`]);
        }
        return sandbox;
    } catch (error) {
        await sandbox[Symbol.asyncDispose]();
        throw error;
    }
}

test.skipIf(isCaseFolding())('staged paths that differ only by letter case keep both spellings and bytes', async () => {
    await using sandbox = await createCaseClashingSandbox();
    const result = await checkReport(sandbox.path, ['check', '--staged', '--only', 'sandbox/report', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = result.report;
    expect(report.checks.map((entry) => [entry.check, entry.status, entry.fileCount])).toStrictEqual([
        ['sandbox/report', 'failed', 2],
    ]);
    expect(
        Object.fromEntries(
            report.checks.flatMap(({ findings }) => findings.map(({ file, message }) => [file, message])),
        ),
    ).toStrictEqual({ 'docs/Notes.md': '# Notes\n', 'docs/NOTES.md': '# NOTES\n' });
});

test.skipIf(!isCaseFolding())('a case-folding disk refuses them', async () => {
    await using sandbox = await createCaseClashingSandbox();
    const result = await checkReport(sandbox.path, ['check', '--staged', '--only', 'sandbox/report', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    const failure = JSON.parse(result.stdout) as CommandFailureJson;
    expect(failure).toStrictEqual({ error: 'files', message: expect.stringContaining('docs/NOTES.md') as string });
});

test('staged checks use index bytes and settings on an unborn branch while preserving unstaged edits', async () => {
    await using folder = await testdir();
    const settings = buildSettingsText(['bash'], { tables: BASH_SYNTAX_CHECK });
    await createFileTree(folder.path, { 'gspot.toml': settings, 'script with spaces.sh': 'if then\n' });
    readGitOutput(folder.path, ['init', '-q']);
    readGitOutput(folder.path, ['add', '-A']);
    const index = readGitOutput(folder.path, ['ls-files', '--stage', '-z']);
    await writeFile(join(folder.path, 'script with spaces.sh'), 'echo repaired only in the working tree\n');
    await writeFile(join(folder.path, 'gspot.toml'), 'invalid working settings');
    const commandArguments = ['check', '--staged', '--only', 'project/bash-syntax', '--json'];
    const failed = await checkReport(folder.path, commandArguments);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const failedReport = failed.report;
    expect(failedReport.comparison?.content).toBe('index');
    expect(failedReport.checks[0]?.reproduce).toContain('--staged');
    expect(new Set(failedReport.checks[0]?.findings.map((finding) => finding.file))).toStrictEqual(
        new Set(['script with spaces.sh']),
    );
    expect(readGitOutput(folder.path, ['ls-files', '--stage', '-z'])).toBe(index);
    expect(await readFile(join(folder.path, 'gspot.toml'), 'utf8')).toBe('invalid working settings');
    expect(await readFile(join(folder.path, 'script with spaces.sh'), 'utf8')).toBe(
        'echo repaired only in the working tree\n',
    );
    await writeFile(join(folder.path, 'gspot.toml'), settings);
    readGitOutput(folder.path, ['add', 'gspot.toml', 'script with spaces.sh']);
    await writeFile(join(folder.path, 'script with spaces.sh'), 'if then\n');
    const passed = await checkReport(folder.path, commandArguments);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    const passedReport = passed.report;
    expect(passedReport.checks[0]?.status).toBe('passed');
    expect(passedReport.comparison?.reference).not.toBe(failedReport.comparison?.reference);
    expect(await readFile(join(folder.path, 'script with spaces.sh'), 'utf8')).toBe('if then\n');
});

test('staged checks read an indexed file when its working file is missing', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'script with spaces.sh': 'echo indexed\n',
    });
    readGitOutput(folder.path, ['init', '-q']);
    readGitOutput(folder.path, ['add', '-A']);
    const commandArguments = ['check', '--staged', '--only', 'project/bash-syntax', '--json'];
    await unlink(join(folder.path, 'script with spaces.sh'));
    const ran = await checkReport(folder.path, commandArguments);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect(ran.report.checks[0]).toMatchObject({ status: 'passed', fileCount: 1 });
    expect(await isOnDisk(join(folder.path, 'script with spaces.sh'))).toBe(false);
});
