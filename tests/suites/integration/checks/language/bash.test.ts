import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { planChecks } from '#cli/planning/checks.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { isWindows } from '#tests/setup/system/platform.ts';
import { createGitSandbox } from '#tests/setup/system/git.ts';
import { parseCommandFindings } from '#cli/runs/command/output.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { spawnGspot, runGspotStep, applyThenInstall, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    SYNTAX_FILES,
    SYNTAX_CASES,
    DIALECT_FIXES,
    DIALECT_SOURCES,
    SHELLCHECK_DIALECT_FINDINGS,
} from '#tests/config/integration/checks/language/bash.ts';

test('ShellCheck reports a finding in a filename that starts with a dash', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        '-f.sh': '#!/bin/sh\necho $1\n',
        'ok.sh': '#!/bin/sh\necho ok\n',
    });
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['apply']);
    const result = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.report.checks).toMatchObject([
        { status: 'failed', fileCount: 2, findings: [{ file: '-f.sh', line: 2, rule: 'SC2086' }] },
    ]);
});

test('ShellCheck reports dialect findings by shebang and an unchecked cd, bash/safety accepts a trap that removes a temporary folder, and no file changes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { level: 'all', scopes: [{ path: 'app' }] }),
        ...DIALECT_SOURCES,
    });
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['apply']);
    const command = ['check', '--only', 'bash/shellcheck,bash/safety', '--json'];
    const checked = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(
        checked.report.checks
            .filter(({ check }) => check === 'bash/safety')
            .map(({ scope, status, findings }) => ({ scope, status, findings })),
    ).toStrictEqual([
        { scope: '', status: 'passed', findings: [] },
        { scope: 'app', status: 'passed', findings: [] },
    ]);
    expect(
        checked.report.checks
            .flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))
            .toSorted((left, right) => left.file.localeCompare(right.file)),
    ).toStrictEqual([...SHELLCHECK_DIALECT_FINDINGS]);
    for (const [path, source] of Object.entries(DIALECT_SOURCES))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(source);
    await createFileTree(sandbox.path, DIALECT_FIXES);
    const corrected = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        corrected.report.checks
            .filter(({ check }) => check === 'bash/shellcheck')
            .map(({ scope, status, fileCount, findings }) => ({ scope, status, fileCount, findings })),
    ).toStrictEqual([
        { scope: '', status: 'passed', fileCount: 6, findings: [] },
        { scope: 'app', status: 'passed', fileCount: 2, findings: [] },
    ]);
});

test('partial ShellCheck output beside an unreadable file is an execution error', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'sample.sh': '#!/usr/bin/env bash\necho $unquoted\n',
    });
    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'commit', only: ['bash/shellcheck'] });
    const planned = plans[0]!;
    const command = ['shellcheck', '--norc', '--format=gcc', 'sample.sh'];
    const paths = { cwd: sandbox.path, root: sandbox.path };
    const broken = runCommandBlocking([...command, 'missing.sh'], { cwd: sandbox.path });
    expect(broken.code, broken.stderr).toBe(2);
    expect(broken.stdout.replaceAll('\r\n', '\n')).toBe(
        'sample.sh:2:6: warning: unquoted is referenced but not assigned. [SC2154]\nsample.sh:2:6: note: Double quote to prevent globbing and word splitting. [SC2086]\n',
    );
    expect(parseCommandFindings(planned, broken, paths).note?.replaceAll('\r\n', '\n')).toBe(
        'shellcheck failed with exit 2:\nmissing.sh: missing.sh: openBinaryFile: does not exist (No such file or directory)\nsample.sh:2:6: warning: unquoted is referenced but not assigned. [SC2154]\nsample.sh:2:6: note: Double quote to prevent globbing and word splitting. [SC2086]',
    );
    const failed = runCommandBlocking(command, { cwd: sandbox.path });
    expect(failed.code).toBe(1);
    expect(
        parseCommandFindings(planned, failed, paths).findings!.map(({ file, line, rule }) => ({ file, line, rule })),
    ).toStrictEqual([
        { file: 'sample.sh', line: 2, rule: 'SC2154' },
        { file: 'sample.sh', line: 2, rule: 'SC2086' },
    ]);
    await writeFile(join(sandbox.path, 'sample.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "${1:-}"\n');
    const corrected = runCommandBlocking(command, { cwd: sandbox.path });
    expect(corrected.code).toBe(0);
    expect(parseCommandFindings(planned, corrected, paths).findings).toStrictEqual([]);
});

test.skipIf(isWindows).each([...SYNTAX_CASES])(
    '$check accepts clean files and reports a syntax error in $path',
    async (row) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['bash'], { level: 'all' }),
            ...SYNTAX_FILES,
        });

        await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['apply']);
        const clean = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', row.check, '--json']));
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        expect(clean.report.checks).toMatchObject([{ status: 'passed', fileCount: row.files.length, findings: [] }]);
        const path = join(sandbox.path, row.path);
        await writeFile(path, row.broken);
        const broken = parseCheckReport(await spawnGspot(sandbox.path, ['check', '--only', row.check, '--json']));
        expect(broken.code, broken.stdout + broken.stderr).toBe(1);
        expect(broken.report.checks).toMatchObject([
            {
                check: row.check,
                status: 'failed',
                findings: [
                    {
                        file: row.path,
                        line: row.line,
                        message: expect.stringContaining(row.message) as string,
                    },
                ],
            },
        ]);
    },
);

test('shfmt reports a syntax error as a finding and passes after the script is repaired', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash', 'format']),
        'broken script.sh': 'if then\n',
    });

    const command = ['check', '--only', 'bash/shfmt', '--json'];
    const failed = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
    expect(failed.exitCode, JSON.stringify(failed)).toBe(1);
    expect(failed.checks).toMatchObject([
        { status: 'failed', findings: [{ file: 'broken script.sh', line: 1, column: 1, fixable: false }] },
    ]);
    await writeFile(join(sandbox.path, 'broken script.sh'), 'echo example\n');
    const correction = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
    expect(correction.exitCode, JSON.stringify(correction)).toBe(0);
    expect(correction.checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('shfmt reports and fixes script formatting with tabs', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash', 'format'], {
            tables: '[format]\nindent_style = "tab"\nindent_width = 4\n',
        }),
        'example.sh': `if true; then
  echo ready
fi
`,
    });

    await applyThenInstall(sandbox.path);
    const command = ['check', '--only', 'bash/shfmt', '--json'];
    const broken = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
    expect(broken.exitCode, JSON.stringify(broken)).toBe(1);
    const correction = parseCheckReport(await spawnGspot(sandbox.path, [...command, '--fix'])).report;
    expect(correction.exitCode, JSON.stringify(correction)).toBe(0);
    expect(await readFile(join(sandbox.path, 'example.sh'), 'utf8')).toBe('if true; then\n\techo ready\nfi\n');
    const verified = parseCheckReport(await spawnGspot(sandbox.path, command)).report;
    expect(verified.exitCode, JSON.stringify(verified)).toBe(0);
});
