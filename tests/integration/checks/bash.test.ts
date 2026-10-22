import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isWindows } from '#tests/setup/system/platform.ts';
import { parseCommandFindings } from '#cli/runs/command/output.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    SYNTAX_FILES,
    SYNTAX_CASES,
    DIALECT_FIXES,
    DIALECT_SOURCES,
    SHELLCHECK_DIALECT_FINDINGS,
} from '#tests/data/integration/checks/bash.ts';

test('ShellCheck reports dialect findings by shebang and an unchecked cd, bash/safety accepts a trap that removes a temporary folder, and no file changes', async () => {
    await using sandbox = await testdir();
    const environment = {};
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all', scopes: [{ path: 'app' }] }),
        ...DIALECT_SOURCES,
    });
    const applied = await spawnGspot(sandbox.path, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const command = ['check', '--only', 'bash/shellcheck,bash/safety', '--json'];
    const checked = parseCheckReport(await spawnGspot(sandbox.path, command, environment));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = checked.report;
    expect(
        report.checks
            .filter(({ check }) => check === 'bash/safety')
            .map(({ scope, status, findings }) => ({ scope, status, findings })),
    ).toStrictEqual([
        { scope: '', status: 'passed', findings: [] },
        { scope: 'app', status: 'passed', findings: [] },
    ]);
    expect(
        report.checks
            .flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))
            .toSorted((left, right) => left.file.localeCompare(right.file)),
    ).toStrictEqual([...SHELLCHECK_DIALECT_FINDINGS]);
    for (const [path, source] of Object.entries(DIALECT_SOURCES))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(source);
    await createFileTree(sandbox.path, DIALECT_FIXES);
    const corrected = parseCheckReport(await spawnGspot(sandbox.path, command, environment));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const clean = corrected.report;
    expect(
        clean.checks
            .filter(({ check }) => check === 'bash/shellcheck')
            .map(({ scope, status, fileCount, findings }) => ({ scope, status, fileCount, findings })),
    ).toStrictEqual([
        { scope: '', status: 'passed', fileCount: 6, findings: [] },
        { scope: 'app', status: 'passed', fileCount: 2, findings: [] },
    ]);
});

test('partial ShellCheck output beside an unreadable file is an execution error', async () => {
    await using sandbox = await testdir();
    const source = '#!/usr/bin/env bash\necho $unquoted\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['bash']),
        'sample.sh': source,
    });
    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'commit', only: ['bash/shellcheck'] });
    const planned = plans[0]!;
    const command = ['shellcheck', '--norc', '--format=gcc', 'sample.sh'];
    const paths = { cwd: sandbox.path, root: sandbox.path };
    const broken = runCommandBlocking([...command, 'missing.sh'], { cwd: sandbox.path });
    expect(broken.code, broken.stderr).toBe(2);
    expect(broken.stdout).toBe(
        'sample.sh:2:6: warning: unquoted is referenced but not assigned. [SC2154]\nsample.sh:2:6: note: Double quote to prevent globbing and word splitting. [SC2086]\n',
    );
    expect(parseCommandFindings(planned, broken, paths).note).toBe(
        'shellcheck crashed with exit 2.\nmissing.sh: missing.sh: openBinaryFile: does not exist (No such file or directory)\nsample.sh:2:6: warning: unquoted is referenced but not assigned. [SC2154]\nsample.sh:2:6: note: Double quote to prevent globbing and word splitting. [SC2086]',
    );
    const failed = runCommandBlocking(command, { cwd: sandbox.path });
    expect(failed.code).toBe(1);
    expect(parseCommandFindings(planned, failed, paths).findings).toContainEqual(
        matchFields({ file: 'sample.sh', line: 2, rule: 'SC2086' }),
    );
    await writeFile(join(sandbox.path, 'sample.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "${1:-}"\n');
    const corrected = runCommandBlocking(command, { cwd: sandbox.path });
    expect(corrected.code).toBe(0);
    expect(parseCommandFindings(planned, corrected, paths).findings).toStrictEqual([]);
});
// Windows has no Zsh; Linux and macOS run the check.
test.skipIf(isWindows).each([...SYNTAX_CASES])(
    '$check accepts clean files and reports a syntax error in $path',
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
                    message: expect.stringContaining(entry.message) as string,
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
