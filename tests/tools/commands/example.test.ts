// The recorded example of the README, the quickstart, and the homepage, replayed through the source CLI.
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import example from '#docs/src/config/example.json';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/public.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { shareToolProjects } from '#tests/harness/install.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { useEnvironment } from '#tests/harness/environment.ts';
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
        .toSorted((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

// Project only declared platform exclusions into the recorded check rows, skips, and totals.
function expectedTranscript(record: string, plan: readonly PlannedCheck[]): string {
    const unsupported = plan.flatMap(({ check, skip }, index) =>
        skip?.cause === 'platform' &&
        new RegExp(String.raw`^root\s+${RegExp.escape(check.name)}\s+passed\s`, 'mu').test(example.rejected)
            ? [{ name: check.name, note: skip.note, index }]
            : [],
    );
    const lines = record.trimEnd().split('\n');
    for (const { name, note, index } of unsupported) {
        const row = lines.findIndex((line) => line.startsWith(`root  ${name} `));
        if (row === -1) continue;
        lines[row] = lines[row]!.replace(/passed.*$/u, `skipped    ${note}`);
        let insertion = lines.length - 2;
        for (const following of plan.slice(index + 1)) {
            const found = lines.findIndex((line) => line.startsWith(`skipped    ${following.check.name}  (`));
            if (found === -1) continue;
            insertion = found;
            break;
        }
        lines.splice(insertion, 0, `skipped    ${name}  (platform)`);
    }
    return lines
        .join('\n')
        .replace(
            /^(\d+) checks passed, (\d+) checks failed, (\d+) checks skipped/mu,
            (_match, passed: string, failed: string, skipped: string) =>
                `${String(Number(passed) - unsupported.length)} checks passed, ${failed} checks failed, ${String(Number(skipped) + unsupported.length)} checks skipped`,
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
    using _tools = useEnvironment(await shareToolProjects(sandbox.path));
    gitOutput(sandbox.path, ['add', '-A']);
    gitOutput(sandbox.path, ['commit', '-qm', 'chore: Set up gspot', '--no-verify']);
    await createFileTree(
        sandbox.path,
        Object.fromEntries(example.agent.files.map((file) => [file.path, file.content])),
    );
    gitOutput(sandbox.path, ['add', '-A']);
    const plan = planRun(await openSession(sandbox.path), { stage: 'all', skips: [] });
    const rejectedHuman = await spawnGspot(sandbox.path, ['check', '--staged']);
    expect(rejectedHuman.code, rejectedHuman.stdout + rejectedHuman.stderr).toBe(1);
    expect(rejectedHuman.stdout.replaceAll(/\b\d+(?:\.\d+)?s\b/gu, '0.0s').trimEnd()).toBe(
        expectedTranscript(example.rejected, plan),
    );
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
    ).toBe(expectedTranscript(example.passed, plan));
});
