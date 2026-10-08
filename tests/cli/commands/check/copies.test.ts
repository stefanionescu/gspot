// Bun check sandboxes read indexed snapshots and preserve working-tree bytes and outputs.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { git, gitOutput } from '#tests/harness/git.ts';
import { getKeptMode } from '#tests/harness/platforms.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { stat, chmod, unlink, readFile, writeFile } from 'node:fs/promises';

const { version: RUNNING_VERSION } = packageManifest;

test('staged checks use index bytes and policy on an unborn branch while preserving unstaged edits', async () => {
    await using directory = await testdir();
    const policy = buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' });
    await createFileTree(directory.path, { 'gspot.toml': policy, 'script with spaces.sh': 'if then\n' });
    expect(git(directory.path, ['init', '-q']).code).toBe(0);
    expect(git(directory.path, ['add', '-A']).code).toBe(0);
    const index = git(directory.path, ['ls-files', '--stage', '-z']).stdout;
    await writeFile(join(directory.path, 'script with spaces.sh'), 'echo repaired only in the working tree\n');
    await writeFile(join(directory.path, 'gspot.toml'), 'invalid working policy');
    const args = ['check', '--staged', '--only', 'bash/syntax', '--json'];
    const failed = await runGspot(directory.path, args);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const failedReport = JSON.parse(failed.stdout) as RunReport;
    expect(failedReport.comparison?.content).toBe('index');
    expect(failedReport.checks[0]?.reproduce).toContain('--staged');
    expect(new Set(failedReport.checks[0]?.findings.map((finding) => finding.file))).toStrictEqual(
        new Set(['script with spaces.sh']),
    );
    expect(git(directory.path, ['ls-files', '--stage', '-z']).stdout).toBe(index);
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe('invalid working policy');
    expect(await readFile(join(directory.path, 'script with spaces.sh'), 'utf8')).toBe(
        'echo repaired only in the working tree\n',
    );
    await writeFile(join(directory.path, 'gspot.toml'), policy);
    expect(git(directory.path, ['add', 'gspot.toml', 'script with spaces.sh']).code).toBe(0);
    await writeFile(join(directory.path, 'script with spaces.sh'), 'if then\n');
    const passed = await runGspot(directory.path, args);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    const passedReport = JSON.parse(passed.stdout) as RunReport;
    expect(passedReport.checks[0]?.status).toBe('passed');
    expect(passedReport.comparison?.reference).not.toBe(failedReport.comparison?.reference);
    expect(await readFile(join(directory.path, 'script with spaces.sh'), 'utf8')).toBe('if then\n');
});

test('staged checks read an indexed file when its working file is missing', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
        'script with spaces.sh': 'echo indexed\n',
    });
    gitOutput(directory.path, ['init', '-q']);
    gitOutput(directory.path, ['add', '-A']);
    const args = ['check', '--staged', '--only', 'bash/syntax', '--json'];
    await unlink(join(directory.path, 'script with spaces.sh'));
    const ran = await runGspot(directory.path, args);
    expect(ran.code, ran.stdout + ran.stderr).toBe(0);
    expect((JSON.parse(ran.stdout) as RunReport).checks[0]).toMatchObject({ status: 'passed', fileCount: 1 });
    expect(await pathExists(join(directory.path, 'script with spaces.sh'))).toBe(false);
});

test('staged checks validate the index version pin instead of the working pin', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
        '.gspot/version': '0.0.0\n',
        'script.sh': 'echo valid\n',
    });
    expect(git(directory.path, ['init', '-q']).code).toBe(0);
    expect(git(directory.path, ['add', '-A']).code).toBe(0);
    await writeFile(join(directory.path, '.gspot/version'), `${RUNNING_VERSION}\n`);
    const args = ['check', '--staged', '--only', 'bash/syntax', '--json'];
    const refused = await runGspot(directory.path, args);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).error).toBe('pin');
    expect(git(directory.path, ['add', '.gspot/version']).code).toBe(0);
    await writeFile(join(directory.path, '.gspot/version'), '0.0.0\n');
    const accepted = await runGspot(directory.path, args);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(await readFile(join(directory.path, '.gspot/version'), 'utf8')).toBe('0.0.0\n');
});

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
    expect(git(directory.path, ['init', '-q']).code).toBe(0);
    expect(git(directory.path, ['add', '-A']).code).toBe(0);
    await writeFile(join(directory.path, 'payload.dat'), Buffer.from([0, 1, 2]));
    await chmod(join(directory.path, 'task.sh'), 0o644);
    const result = await runGspot(directory.path, ['check', '--staged', '--only', 'project/index-bytes', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect((JSON.parse(result.stdout) as RunReport).checks[0]?.status).toBe('passed');
    expect(await readFile(join(directory.path, 'payload.dat'))).toStrictEqual(Buffer.from([0, 1, 2]));
    const attributes = await stat(join(directory.path, 'task.sh'));
    expect(attributes.mode & 0o777).toBe(getKeptMode(0o644));
    expect(await pathExists(join(directory.path, 'created.txt'))).toBe(false);
});

test('index checks copy matching locked dependencies and refuse a different working lockfile', async () => {
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
    expect(git(directory.path, ['init', '-q']).code).toBe(0);
    expect(git(directory.path, ['add', '-A']).code).toBe(0);
    const args = ['check', '--staged', '--only', 'project/dependencies', '--json'];
    const first = await runGspot(directory.path, args);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect(await readFile(join(directory.path, 'node_modules/dependency/stamp.txt'), 'utf8')).toBe(
        'authored dependency data',
    );
    await writeFile(join(directory.path, 'package-lock.json'), lockfile + '\n');
    const refused = await runGspot(directory.path, args);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain(
        'do not match the revision manifests and lockfiles',
    );
    await writeFile(join(directory.path, 'package-lock.json'), lockfile);
    const corrected = await runGspot(directory.path, args);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(await readFile(join(directory.path, 'node_modules/dependency/stamp.txt'), 'utf8')).toBe(
        'authored dependency data',
    );
    expect(await readFile(join(directory.path, 'source.txt'), 'utf8')).toBe('authored input');
});
