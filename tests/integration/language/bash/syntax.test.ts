import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { toolsPath } from '#tests/setup/install.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { mkdir, symlink, readFile } from 'node:fs/promises';
import { type RunReport } from '#cli/types/execution/check.ts';
import { type DoctorReport } from '#cli/types/commands/doctor.ts';
import { containing, textContaining } from '#tests/setup/matchers.ts';
import { isMacos, isWindows } from '#tests/setup/operating-systems.ts';
import { SYNTAX_FILES, SYNTAX_CASES, BATS_MINIMUM_FILES } from '#tests/config/bash/tools.ts';

// This check uses the Bash version supplied by macOS.
test.skipIf(!isMacos)('with macOS Bash 3.2, bash-syntax runs and bats-syntax reports Bash 4.4 as missing', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...BATS_MINIMUM_FILES,
        'gspot.toml': settingsText(['bash'], { level: 'all' }),
    });
    const bin = join(sandbox.path, 'bin');
    await mkdir(bin);
    await symlink('/bin/bash', join(bin, 'bash'));
    const available = { PATH: toolsPath() };
    const stock = { PATH: `${bin}${delimiter}${available.PATH}` };
    const applied = await spawnGspot(sandbox.path, ['apply'], stock);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const syntax = await spawnGspot(sandbox.path, ['check', '--only', 'bash/bash-syntax', '--json'], stock);
    expect(syntax.code, syntax.stdout + syntax.stderr).toBe(0);
    expect((JSON.parse(syntax.stdout) as RunReport).checks).toMatchObject([
        { check: 'bash/bash-syntax', status: 'passed', fileCount: 1, findings: [] },
    ]);
    const blocked = await spawnGspot(sandbox.path, ['check', '--only', 'bash/bats-syntax', '--json'], stock);
    expect(blocked.code, blocked.stdout + blocked.stderr).toBe(2);
    const requirement = (JSON.parse(blocked.stdout) as RunReport).checks[0];
    expect(requirement).toMatchObject({ check: 'bash/bats-syntax', status: 'missing', findings: [] });
    expect(requirement?.note).toContain('bash');
    expect(requirement?.note).toContain('4.4');
    const doctor = await spawnGspot(sandbox.path, ['doctor', '--json'], stock);
    expect(doctor.code, doctor.stdout + doctor.stderr).toBe(1);
    expect((JSON.parse(doctor.stdout) as DoctorReport).tools.find((tool) => tool.name === 'bash')).toMatchObject({
        state: 'outdated',
        found: '3.2.57',
        floor: '4.4',
    });
    const parsed = await spawnGspot(sandbox.path, ['check', '--only', 'bash/bats-syntax', '--json'], available);
    expect(parsed.code, parsed.stdout + parsed.stderr).toBe(1);
    expect((JSON.parse(parsed.stdout) as RunReport).checks[0]?.findings).toMatchObject([
        { file: 'script.bats', line: 2 },
    ]);
});

// Windows has no Zsh or Bats; Linux and macOS run all three.
test.each([...(isWindows ? SYNTAX_CASES.slice(0, 1) : SYNTAX_CASES)])(
    '$check accepts clean files and reports syntax in $path',
    async (entry) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['bash'], { level: 'all' }),
            ...SYNTAX_FILES,
        });
        const environment = { PATH: toolsPath() };
        const applied = await spawnGspot(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const clean = await spawnGspot(sandbox.path, ['check', '--only', entry.check, '--json'], environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        const report = JSON.parse(clean.stdout) as RunReport;
        expect(report.checks[0]?.status).toBe('passed');
        expect(report.checks[0]?.fileCount).toBe(entry.files.length);
        const path = join(sandbox.path, entry.path);
        const original = await readFile(path);
        try {
            await Bun.write(path, entry.broken);
            const broken = await spawnGspot(sandbox.path, ['check', '--only', entry.check, '--json'], environment);
            expect(broken.code, broken.stdout + broken.stderr).toBe(1);
            const failed = JSON.parse(broken.stdout) as RunReport;
            expect(failed.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
            expect(failed.checks[0]!.findings).toContainEqual(
                containing({
                    file: entry.path,
                    line: entry.line,
                    message: textContaining(entry.message),
                }),
            );
        } finally {
            await Bun.write(path, original);
        }
    },
);

test('shfmt reports a syntax error as a finding and passes after the script is repaired', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['bash', 'format']),
        'broken script.sh': 'if then\n',
    });
    const command = ['check', '--only', 'bash/shfmt', '--json'];
    const failedCommand = await spawnGspot(sandbox.path, command);
    const failed = JSON.parse(failedCommand.stdout) as RunReport;
    expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
    expect(failed.checks).toMatchObject([
        { status: 'failed', findings: [{ file: 'broken script.sh', line: 1, column: 1, fixable: false }] },
    ]);
    await Bun.write(join(sandbox.path, 'broken script.sh'), 'echo example\n');
    const correctionCommand = await spawnGspot(sandbox.path, command);
    const correction = JSON.parse(correctionCommand.stdout) as RunReport;
    expect(correction.exitCode, JSON.stringify(correction)).toBe(0);
    expect(correction.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});
