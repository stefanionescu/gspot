import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { git } from '#tests/support/cli/git.ts';
import { createFileTree, testdir } from 'testdirs';
import { run } from '#tests/support/cli/command.ts';
import { reportSchema } from '#cli/execution/report.ts';
import packageManifest from '../../../../packages/cli/package.json' with { type: 'json' };
import { chmodSync, existsSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';

const { version: GSPOT_VERSION } = packageManifest;

test('an ignored folder includes descendants while a negated file remains enforced', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n',
        'legacy scripts/nested/example.sh': 'if then\n',
        'legacy scripts/required.sh': 'if then\n',
        'entry.sh': 'echo example\n',
    });
    const ignored = await run(directory.path, [
        'ignore',
        'bash/syntax',
        '--paths',
        'legacy scripts',
        '!legacy scripts/required.sh',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const command = ['check', '--only', 'bash/syntax', '--no-cache', '--json'];
    const checked = await run(directory.path, command);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = reportSchema.parse(JSON.parse(checked.stdout));
    expect(report.checks[0]?.findings.map(({ file }) => file)).toStrictEqual([
        'legacy scripts/required.sh',
        'legacy scripts/required.sh',
    ]);
    expect(report.ignores[0]?.matched).toBe(0);
    writeFileSync(join(directory.path, 'legacy scripts/required.sh'), 'echo corrected\n');
    const corrected = await run(directory.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const removed = await run(directory.path, [
        'ignore',
        'bash/syntax',
        '--paths',
        'legacy scripts',
        '!legacy scripts/required.sh',
        '--remove',
    ]);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    const restored = await run(directory.path, command);
    expect(restored.code, restored.stdout + restored.stderr).toBe(1);
    expect(reportSchema.parse(JSON.parse(restored.stdout)).checks[0]?.findings.map(({ file }) => file)).toStrictEqual([
        'legacy scripts/nested/example.sh',
        'legacy scripts/nested/example.sh',
    ]);
});

test('staged checks use index bytes and policy on an unborn branch while preserving unstaged edits', async () => {
    await using directory = await testdir();
    const policy = 'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n';
    await createFileTree(directory.path, { 'gspot.toml': policy, 'script with spaces.sh': 'if then\n' });
    expect(git(directory.path, ['init', '-q']).code).toBe(0);
    expect(git(directory.path, ['add', '-A']).code).toBe(0);
    const index = git(directory.path, ['ls-files', '--stage', '-z']).stdout;
    writeFileSync(join(directory.path, 'script with spaces.sh'), 'echo repaired only in the working tree\n');
    writeFileSync(join(directory.path, 'gspot.toml'), 'invalid working policy');
    const args = ['check', '--staged', '--only', 'bash/syntax', '--json'];
    const failed = await run(directory.path, args);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const failedReport = reportSchema.parse(JSON.parse(failed.stdout));
    expect(failedReport.comparison?.content).toBe('index');
    expect(failedReport.checks[0]?.reproduce).toContain('--staged');
    const text = await run(
        directory.path,
        args.filter((argument) => argument !== '--json'),
    );
    expect(text.stdout).toContain('checked index;');
    expect(text.stdout).not.toContain('checked working tree;');
    expect(failedReport.checks[0]?.findings.map((finding) => finding.file)).toStrictEqual([
        'script with spaces.sh',
        'script with spaces.sh',
    ]);
    expect(git(directory.path, ['ls-files', '--stage', '-z']).stdout).toBe(index);
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe('invalid working policy');
    expect(readFileSync(join(directory.path, 'script with spaces.sh'), 'utf8')).toBe(
        'echo repaired only in the working tree\n',
    );
    writeFileSync(join(directory.path, 'gspot.toml'), policy);
    expect(git(directory.path, ['add', 'gspot.toml', 'script with spaces.sh']).code).toBe(0);
    writeFileSync(join(directory.path, 'script with spaces.sh'), 'if then\n');
    const passed = await run(directory.path, args);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    const passedReport = reportSchema.parse(JSON.parse(passed.stdout));
    expect(passedReport.checks[0]?.status).toBe('ok');
    expect(passedReport.comparison?.reference).not.toBe(failedReport.comparison?.reference);
    expect(readFileSync(join(directory.path, 'script with spaces.sh'), 'utf8')).toBe('if then\n');
    expect(JSON.parse(readFileSync(join(directory.path, '.gspot/reports/report.json'), 'utf8'))).toStrictEqual(
        JSON.parse(passed.stdout),
    );
    unlinkSync(join(directory.path, 'script with spaces.sh'));
    expect((await run(directory.path, args)).code).toBe(0);
});

test('staged checks validate the index version pin instead of the working pin', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n',
        '.gspot/version': '0.0.0\n',
        'script.sh': 'echo valid\n',
    });
    expect(git(directory.path, ['init', '-q']).code).toBe(0);
    expect(git(directory.path, ['add', '-A']).code).toBe(0);
    writeFileSync(join(directory.path, '.gspot/version'), `${GSPOT_VERSION}\n`);
    const args = ['check', '--staged', '--only', 'bash/syntax', '--json'];
    const refused = await run(directory.path, args);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(JSON.parse(refused.stdout).error).toBe('VersionPinError');
    expect(git(directory.path, ['add', '.gspot/version']).code).toBe(0);
    writeFileSync(join(directory.path, '.gspot/version'), '0.0.0\n');
    const accepted = await run(directory.path, args);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    expect(readFileSync(join(directory.path, '.gspot/version'), 'utf8')).toBe('0.0.0\n');
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
        process.exit(bytes.equals(Buffer.from([255, 10, 0])) && (statSync('task.sh').mode & 0o111) !== 0 ? 0 : 1);
    `,
    ];
    await createFileTree(directory.path, {
        '.gitattributes': 'payload.dat text eol=crlf\n',
        'payload.dat': Buffer.from([255, 10, 0]),
        'task.sh': '#!/bin/sh\nexit 0\n',
        'gspot.toml': `version = 1
configurations = []
[[check]]
name = "project/index-bytes"
command = ${JSON.stringify(command)}
paths = ["payload.dat", "task.sh"]
stage = "commit"
`,
    });
    chmodSync(join(directory.path, 'task.sh'), 0o755);
    expect(git(directory.path, ['init', '-q']).code).toBe(0);
    expect(git(directory.path, ['add', '-A']).code).toBe(0);
    writeFileSync(join(directory.path, 'payload.dat'), Buffer.from([0, 1, 2]));
    chmodSync(join(directory.path, 'task.sh'), 0o644);
    const result = await run(directory.path, ['check', '--staged', '--only', 'project/index-bytes', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(reportSchema.parse(JSON.parse(result.stdout)).checks[0]?.status).toBe('ok');
    expect(readFileSync(join(directory.path, 'payload.dat'))).toStrictEqual(Buffer.from([0, 1, 2]));
    expect(statSync(join(directory.path, 'task.sh')).mode & 0o777).toBe(0o644);
    expect(existsSync(join(directory.path, 'created.txt'))).toBe(false);
});

test('index checks copy matching locked dependencies and refuse a different working lock', async () => {
    await using directory = await testdir();
    const manifest = { name: 'snapshot-project', private: true, type: 'module', dependencies: { dependency: '1.0.0' } };
    const lock = JSON.stringify({
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
        'package-lock.json': lock,
        'node_modules/dependency/package.json':
            '{"name":"dependency","version":"1.0.0","type":"module","exports":"./index.js"}',
        'node_modules/dependency/index.js': 'export const verdict = true;\n',
        'node_modules/dependency/stamp.txt': 'authored dependency data',
        'source.txt': 'authored input',
        'gspot.toml': `version = 1
configurations = []
[[check]]
name = "project/dependencies"
command = ${JSON.stringify(command)}
paths = ["source.txt"]
stage = "commit"
`,
    });
    expect(git(directory.path, ['init', '-q']).code).toBe(0);
    expect(git(directory.path, ['add', '-A']).code).toBe(0);
    const args = ['check', '--staged', '--only', 'project/dependencies', '--json'];
    const first = await run(directory.path, args);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    expect(readFileSync(join(directory.path, 'node_modules/dependency/stamp.txt'), 'utf8')).toBe(
        'authored dependency data',
    );
    writeFileSync(join(directory.path, 'package-lock.json'), lock + '\n');
    const refused = await run(directory.path, args);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(JSON.parse(refused.stdout).message).toContain('do not match the revision manifests and locks');
    writeFileSync(join(directory.path, 'package-lock.json'), lock);
    const corrected = await run(directory.path, args);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(readFileSync(join(directory.path, 'node_modules/dependency/stamp.txt'), 'utf8')).toBe(
        'authored dependency data',
    );
    expect(readFileSync(join(directory.path, 'source.txt'), 'utf8')).toBe('authored input');
});
