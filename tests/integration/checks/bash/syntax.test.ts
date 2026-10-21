import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { isWindows } from '#tests/setup/system.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { matchFields, matchSubstring } from '#tests/setup/matchers.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { SYNTAX_CASES, SYNTAX_FILES } from '#tests/data/checks/bash/tool-checks.ts';

// Windows has no Zsh; Linux and macOS run the check.
test.skipIf(isWindows).each([...SYNTAX_CASES])(
    '$check accepts clean files and reports syntax in $path',
    async (entry) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
            ...SYNTAX_FILES,
        });

        const environment = {};
        const applied = await spawnGspot(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const clean = parseCheckReport(
            await spawnGspot(sandbox.path, ['check', '--only', entry.check, '--json'], environment),
        );
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        const report = clean.report;
        expect(report.checks[0]?.status).toBe('passed');
        expect(report.checks[0]?.fileCount).toBe(entry.files.length);
        const path = join(sandbox.path, entry.path);
        const original = await readFile(path);
        try {
            await writeFile(path, entry.broken);
            const broken = parseCheckReport(
                await spawnGspot(sandbox.path, ['check', '--only', entry.check, '--json'], environment),
            );
            expect(broken.code, broken.stdout + broken.stderr).toBe(1);
            const failed = broken.report;
            expect(failed.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
            expect(failed.checks[0]!.findings).toContainEqual(
                matchFields({
                    file: entry.path,
                    line: entry.line,
                    message: matchSubstring(entry.message),
                }),
            );
        } finally {
            await writeFile(path, original);
        }
    },
);

test('shfmt reports a syntax error as a finding and passes after the script is repaired', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash', 'format']),
        'broken script.sh': 'if then\n',
    });

    const command = ['check', '--only', 'bash/shfmt', '--json'];
    const failedCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
    const failed = failedCommand.report;
    expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
    expect(failed.checks).toMatchObject([
        { status: 'failed', findings: [{ file: 'broken script.sh', line: 1, column: 1, fixable: false }] },
    ]);
    await writeFile(join(sandbox.path, 'broken script.sh'), 'echo example\n');
    const correctionCommand = parseCheckReport(await spawnGspot(sandbox.path, command));
    const correction = correctionCommand.report;
    expect(correction.exitCode, JSON.stringify(correction)).toBe(0);
    expect(correction.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});
