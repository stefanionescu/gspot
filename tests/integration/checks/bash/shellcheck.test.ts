import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { matchFields } from '#tests/setup/matchers.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { type RunReport } from '#cli/types/runs/check.ts';
import { buildSandboxPath } from '#tests/setup/install.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runCommandBlocking } from '#tests/setup/processes.ts';
import { parseCommandFindings } from '#cli/runs/command/output.ts';
import { DIALECT_FIXES, DIALECT_SOURCES } from '#tests/data/checks/bash/tool-checks.ts';

test('ShellCheck reports dialect findings by shebang and an unchecked cd, and changes no file', async () => {
    await using sandbox = await testdir();
    const environment = { PATH: buildSandboxPath() };
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['bash'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\n\n',
        }),
        ...DIALECT_SOURCES,
    });
    const applied = await spawnGspot(sandbox.path, ['apply'], environment);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const command = ['check', '--only', 'bash/shellcheck,bash/safety', '--json'];
    const checked = await spawnGspot(sandbox.path, command, environment);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = JSON.parse(checked.stdout) as RunReport;
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
    ).toStrictEqual([
        { file: 'app/posix.sh', rule: 'SC3010' },
        { file: 'dash.sh', rule: 'SC3010' },
        { file: 'posix.sh', rule: 'SC3010' },
        { file: 'unchecked.sh', rule: 'SC2164' },
    ]);
    for (const [path, source] of Object.entries(DIALECT_SOURCES))
        expect(await readFile(join(sandbox.path, path), 'utf8')).toBe(source);
    await createFileTree(sandbox.path, DIALECT_FIXES);
    const corrected = await spawnGspot(sandbox.path, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    const clean = JSON.parse(corrected.stdout) as RunReport;
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
        'gspot.toml': buildSettingsText(['bash']),
        'sample.sh': source,
    });
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', only: ['bash/shellcheck'] });
    const planned = plans[0]!;
    const command = ['shellcheck', '--norc', '--format=gcc', 'sample.sh'];
    const paths = { cwd: sandbox.path, root: sandbox.path };
    const broken = runCommandBlocking([...command, 'missing.sh'], { cwd: sandbox.path });
    expect(broken.code, broken.stderr).toBe(2);
    expect(broken.stdout).toContain('SC2086');
    expect(parseCommandFindings(planned, broken, paths).note).toContain('missing.sh');
    const failed = runCommandBlocking(command, { cwd: sandbox.path });
    expect(failed.code).toBe(1);
    expect(parseCommandFindings(planned, failed, paths).findings).toContainEqual(
        matchFields({ file: 'sample.sh', line: 2, rule: 'SC2086' }),
    );
    await Bun.write(join(sandbox.path, 'sample.sh'), '#!/usr/bin/env bash\nprintf "%s\\n" "${1:-}"\n');
    const corrected = runCommandBlocking(command, { cwd: sandbox.path });
    expect(corrected.code).toBe(0);
    expect(parseCommandFindings(planned, corrected, paths).findings).toStrictEqual([]);
});
