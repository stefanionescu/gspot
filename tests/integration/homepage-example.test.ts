import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import example from '#docs/src/config/example.json';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { runGit, commitAll, readGitOutput } from '#tests/setup/git.ts';
import type { Finding, RunReport } from '#cli/types/checks/run/check.ts';

// The fields a recorded finding holds, in one order, so a run compares with the record whatever order it reports in.
function sortFindings(findings: readonly Pick<Finding, 'check' | 'file' | 'line' | 'column' | 'rule' | 'message'>[]) {
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
    const unsupported = report.skips.filter(({ cause }) => cause === 'system').map(({ check }) => check);
    return record
        .trimEnd()
        .split('\n')
        .filter((line) => !/^(?:Failed:|Could not run:|Passed:|Skipped:|Time:)/u.test(line))
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
    });
    commitAll(sandbox.path);
    const applied = await spawnGspot(sandbox.path, ['init', '--yes']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const installed = await spawnGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    readGitOutput(sandbox.path, ['add', '-A']);
    readGitOutput(sandbox.path, ['commit', '-qm', 'chore: Set up gspot', '--no-verify']);
    await createFileTree(
        sandbox.path,
        Object.fromEntries(example.agent.files.map((file) => [file.path, file.content])),
    );
    readGitOutput(sandbox.path, ['add', '-A']);
    const rejectedHuman = await spawnGspot(sandbox.path, ['check', '--hook', 'pre-commit']);
    expect(rejectedHuman.code, rejectedHuman.stdout + rejectedHuman.stderr).toBe(1);
    const rejected = await spawnGspot(sandbox.path, ['check', '--hook', 'pre-commit', '--json']);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    const rejectedReport = JSON.parse(rejected.stdout) as RunReport;
    expect(dropOperatingSystemSkips(rejectedHuman.stdout, rejectedReport)).toBe(
        dropOperatingSystemSkips(example.rejected, rejectedReport),
    );
    const findings = rejectedReport.checks.flatMap((check) => check.findings);
    expect(sortFindings(findings)).toStrictEqual(sortFindings(example.findings));
    for (const path of example.fix.deleted) await rm(join(sandbox.path, path));
    await createFileTree(sandbox.path, Object.fromEntries(example.fix.files.map((file) => [file.path, file.content])));
    expect(runGit(sandbox.path, ['add', '-A']).code).toBe(0);
    const passed = await spawnGspot(sandbox.path, ['check', '--hook', 'pre-commit', '--json']);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    const passedHuman = await spawnGspot(sandbox.path, ['check', '--hook', 'pre-commit']);
    expect(passedHuman.code, passedHuman.stdout + passedHuman.stderr).toBe(0);
});
