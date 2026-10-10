// Bun check sandboxes read indexed snapshots and preserve working-tree bytes and outputs.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { gitOutput } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { runGspot, checkReport } from '#tests/harness/gspot.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { stat, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';

test('index snapshots preserve binary bytes and executable modes without applying checkout conversion or writing source outputs', async () => {
    await using directory = await testdir();
    const command = [
        process.execPath,
        '-e',
        `
        import { statSync } from 'node:fs';
        const bytes = Buffer.from(await Bun.file('payload.dat').arrayBuffer());
        await Bun.write('created.txt', 'snapshot output');
        // Windows file systems keep no executable bit to compare.
        const isExecutable = process.platform === 'win32' || (statSync('task.sh').mode & 0o111) !== 0;
        process.exit(bytes.equals(Buffer.from([255, 10, 0])) && isExecutable ? 0 : 1);
    `,
    ];
    await createFileTree(directory.path, {
        '.gitattributes': 'payload.dat text eol=crlf\n',
        'payload.dat': Buffer.from([255, 10, 0]),
        'task.sh': '#!/bin/sh\nexit 0\n',
        'gspot.toml': `configurations = []
[check."project/index-bytes"]
command = ${JSON.stringify(command)}
paths = ["payload.dat", "task.sh"]
stage = "commit"
`,
    });
    await chmod(join(directory.path, 'task.sh'), 0o755);
    gitOutput(directory.path, ['init', '-q']);
    gitOutput(directory.path, ['add', '-A']);
    await writeFile(join(directory.path, 'payload.dat'), Buffer.from([0, 1, 2]));
    await chmod(join(directory.path, 'task.sh'), 0o644);
    const result = await checkReport(directory.path, ['check', '--staged', '--only', 'project/index-bytes', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.report.checks[0]?.status).toBe('passed');
    expect(await readFile(join(directory.path, 'payload.dat'))).toStrictEqual(Buffer.from([0, 1, 2]));
    const attributes = await stat(join(directory.path, 'task.sh'));
    expect(attributes.mode & 0o777).toBe(getKeptMode(0o644));
    expect(await pathExists(join(directory.path, 'created.txt'))).toBe(false);
});

test('index checks copy matching locked dependencies and preserve authored files', async () => {
    await using directory = await testdir();
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
    await createFileTree(directory.path, {
        '.gitignore': '.gspot/\nnode_modules/\n',
        'package.json': JSON.stringify(manifest),
        'package-lock.json': lockfile,
        'node_modules/dependency/package.json':
            '{"name":"dependency","version":"1.0.0","type":"module","exports":"./index.js"}',
        'node_modules/dependency/index.js': 'export const verdict = true;\n',
        'node_modules/dependency/stamp.txt': 'authored dependency data',
        'source.txt': 'authored input',
        'gspot.toml': `configurations = []
[check."project/dependencies"]
command = ${JSON.stringify(command)}
paths = ["source.txt"]
stage = "commit"
`,
    });
    gitOutput(directory.path, ['init', '-q']);
    gitOutput(directory.path, ['add', '-A']);
    const args = ['check', '--staged', '--only', 'project/dependencies', '--json'];
    const first = await runGspot(directory.path, args);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect(await readFile(join(directory.path, 'node_modules/dependency/stamp.txt'), 'utf8')).toBe(
        'authored dependency data',
    );
    expect(await readFile(join(directory.path, 'source.txt'), 'utf8')).toBe('authored input');
});

test.each(['recommended', 'all'] as const)(
    'staged Python drift keeps the verified project environments at %s',
    async (level) => {
        await using sandbox = await testdir();
        const project = '[project]\nname = "example"\nversion = "0.0.0"\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['python'], {
                level,
                tables: '[scope.child]\nconfigurations = ["python"]\n',
            }),
            'pyproject.toml': project,
            'main.py': 'value = 1\n',
            'child/pyproject.toml': project,
            'child/main.py': 'value = 2\n',
        });
        for (const scope of ['', 'child']) await mkdir(join(sandbox.path, scope, '.venv'));
        const session = await openSession(sandbox.path);
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, emitAll(session), log);
        gitOutput(sandbox.path, ['init', '-q']);
        gitOutput(sandbox.path, ['add', '-A']);
        const original = await readFile(join(sandbox.path, '.gspot/config/basedpyrightconfig.json'));
        const args = ['check', '--staged', '--only', 'gspot/drift', '--json'];
        const checked = await checkReport(sandbox.path, args);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        expect(
            checked.report.checks
                .flatMap((check) => check.findings)
                .filter((finding) => finding.file.endsWith('/basedpyrightconfig.json')),
        ).toStrictEqual([]);
        expect(await readFile(join(sandbox.path, '.gspot/config/basedpyrightconfig.json'))).toEqual(original);
        await writeFile(join(sandbox.path, 'child/pyproject.toml'), project + '# Unstaged project change.\n');
        const refused = await runGspot(sandbox.path, args);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain(
            'do not match the revision manifests and lockfiles',
        );
        expect(await readFile(join(sandbox.path, '.gspot/config/basedpyrightconfig.json'))).toEqual(original);
    },
);
