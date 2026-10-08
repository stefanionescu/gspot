// The recorded example of the README, the quickstart, and the homepage, replayed through the source CLI.
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import example from '#docs/src/config/example.json';
import { spawnGspot } from '#tests/harness/gspot.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { installToolProjects } from '#tests/harness/install.ts';
import { git, commitAll, gitOutput } from '#tests/harness/git.ts';

// The fields a recorded finding holds, in one order, so a run compares with the record whatever order it reports in.
function recorded(findings: readonly Pick<Finding, 'check' | 'file' | 'line' | 'column' | 'rule' | 'message'>[]) {
    return findings
        .map((finding) => ({
            check: finding.check,
            file: finding.file,
            line: finding.line,
            column: finding.column,
            rule: finding.rule,
            message: finding.message,
        }))
        .toSorted((a, b) =>
            `${a.check}${String(a.column)}${a.message}`.localeCompare(`${b.check}${String(b.column)}${b.message}`),
        );
}

test('the recorded example reports the agent findings and passes after the fix', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...Object.fromEntries(example.project.map((file) => [file.path, file.content])),
        'gspot.toml': example.policy,
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
    expect(rejectedHuman.stdout.replaceAll(/\b\d+(?:\.\d+)?s\b/gu, '0.0s').trimEnd()).toBe(example.rejected.trimEnd());
    const rejected = await spawnGspot(sandbox.path, ['check', '--staged', '--json']);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    const findings = (JSON.parse(rejected.stdout) as RunReport).checks.flatMap((check) => check.findings);
    expect(recorded(findings)).toStrictEqual(recorded(example.findings));
    for (const path of example.fix.deleted) await rm(join(sandbox.path, path));
    await createFileTree(sandbox.path, Object.fromEntries(example.fix.files.map((file) => [file.path, file.content])));
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    const passed = await spawnGspot(sandbox.path, ['check', '--staged', '--json']);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    const passedHuman = await spawnGspot(sandbox.path, ['check', '--staged']);
    expect(passedHuman.code, passedHuman.stdout + passedHuman.stderr).toBe(0);
    expect(
        passedHuman.stdout
            .trimEnd()
            .split('\n')
            .at(-1)!
            .replaceAll(/\b\d+(?:\.\d+)?s\b/gu, '0.0s'),
    ).toBe(example.passed.trimEnd());
});
