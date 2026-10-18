import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { type RunReport } from '#cli/types/runs/check.ts';
import { buildSandboxPath } from '#tests/setup/install.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { SYNTAX_CASES, SYNTAX_FILES } from '#tests/data/checks/bash/tool-checks.ts';

// Windows has no Zsh; Linux and macOS run the check.
test.skipIf(isWindows).each([...SYNTAX_CASES])(
    '$check accepts clean files and reports syntax in $path',
    async (entry) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['bash'], { level: 'all' }),
            ...SYNTAX_FILES,
        });
        const environment = { PATH: buildSandboxPath() };
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
                matchFields({
                    file: entry.path,
                    line: entry.line,
                    message: matchSubstring(entry.message),
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
        'gspot.toml': buildSettingsText(['bash', 'format']),
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
