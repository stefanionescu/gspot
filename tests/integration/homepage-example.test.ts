import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import example from '#docs/src/config/example.json';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { installToolProjects } from '#tests/setup/install.ts';
import { git, commitAll, gitOutput } from '#tests/setup/git.ts';
import type { Finding, RunReport } from '#cli/types/execution/check.ts';

// The fields a recorded finding holds, in one order, so a run compares with the record whatever order it reports in.
function sortedFindings(findings: readonly Pick<Finding, 'check' | 'file' | 'line' | 'column' | 'rule' | 'message'>[]) {
    return findings
        .map((finding) => ({
            check: finding.check,
            file: finding.file,
            line: finding.line,
            column: finding.column,
            rule: finding.rule,
            message: finding.message,
        }))
        .toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

// Remove the same unsupported check rows from the transcript and the current run.
function dropOperatingSystemSkips(record: string, report: RunReport): string {
    const unsupported = report.skips.filter(({ cause }) => cause === 'platform').map(({ check }) => check);
    return record
        .trimEnd()
        .split('\n')
        .filter((line) => !/^\d+ checks passed, /u.test(line))
        .filter(
            (line) =>
                !unsupported.some(
                    (check) => line.startsWith(`root  ${check} `) || line.startsWith(`skipped    ${check}  (`),
                ),
        )
        .join('\n')
        .replaceAll(/\b\d+(?:\.\d+)?s\b/gu, '0.0s')
        .trimEnd();
}

test('the recorded example reports the agent findings and passes after the fix', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...Object.fromEntries(example.project.map((file) => [file.path, file.content])),
        'gspot.toml': example.settings,
    });
    commitAll(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installToolProjects(sandbox.path);
    gitOutput(sandbox.path, ['add', '-A']);
    gitOutput(sandbox.path, ['commit', '-qm', 'chore: Set up gspot', '--no-verify']);
    await createFileTree(
        sandbox.path,
        Object.fromEntries(example.agent.files.map((file) => [file.path, file.content])),
    );
    gitOutput(sandbox.path, ['add', '-A']);
    const rejectedHuman = await spawnGspot(sandbox.path, ['check', '--staged']);
    expect(rejectedHuman.code, rejectedHuman.stdout + rejectedHuman.stderr).toBe(1);
    const rejected = await spawnGspot(sandbox.path, ['check', '--staged', '--json']);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    const rejectedReport = JSON.parse(rejected.stdout) as RunReport;
    expect(dropOperatingSystemSkips(rejectedHuman.stdout, rejectedReport)).toBe(
        dropOperatingSystemSkips(example.rejected, rejectedReport),
    );
    const rejectedTotals = /^(\d+) checks passed, (\d+) checks failed, (\d+) checks skipped/mu.exec(
        rejectedHuman.stdout,
    )!;
    expect(rejectedTotals.slice(1).map(Number)).toStrictEqual(
        ['passed', 'failed', 'skipped'].map(
            (status) => rejectedReport.checks.filter((check) => check.status === status).length,
        ),
    );
    const findings = rejectedReport.checks.flatMap((check) => check.findings);
    expect(sortedFindings(findings)).toStrictEqual(sortedFindings(example.findings));
    for (const path of example.fix.deleted) await rm(join(sandbox.path, path));
    await createFileTree(sandbox.path, Object.fromEntries(example.fix.files.map((file) => [file.path, file.content])));
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    const passed = await spawnGspot(sandbox.path, ['check', '--staged', '--json']);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    const passedHuman = await spawnGspot(sandbox.path, ['check', '--staged']);
    expect(passedHuman.code, passedHuman.stdout + passedHuman.stderr).toBe(0);
    const passedReport = JSON.parse(passed.stdout) as RunReport;
    const passedTotals = /^(\d+) checks passed, (\d+) checks failed, (\d+) checks skipped/mu.exec(passedHuman.stdout)!;
    expect(passedTotals.slice(1).map(Number)).toStrictEqual(
        ['passed', 'failed', 'skipped'].map(
            (status) => passedReport.checks.filter((check) => check.status === status).length,
        ),
    );
});
