// The recorded example of the README, the quickstart, and the homepage, replayed through the source CLI.
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { run } from '#tests/harness/cli/command.ts';
import example from '#docs/src/components/home/example.json';
import { INSTALL_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { git, commitAll, gitOutput } from '#tests/harness/cli/git.ts';
import { installPrivateTools } from '#tests/harness/tools/install.ts';

// The fields a recorded finding holds, in one order, so a run compares with the record whatever order it reports in.
function recorded(
    findings: readonly {
        check: string;
        file: string;
        line?: number | undefined;
        column?: number | undefined;
        rule?: string | undefined;
        message: string;
    }[],
) {
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

test(
    'the recorded example rejects the agent commit with its findings and accepts the fixed commit',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...Object.fromEntries(example.project.map((file) => [file.path, file.content])),
            'gspot.toml': example.policy,
        });
        commitAll(sandbox.path);
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        gitOutput(sandbox.path, ['add', '-A']);
        gitOutput(sandbox.path, ['commit', '-qm', 'chore: Set up gspot', '--no-verify']);
        await createFileTree(
            sandbox.path,
            Object.fromEntries(example.agent.files.map((file) => [file.path, file.content])),
        );
        gitOutput(sandbox.path, ['add', '-A']);
        const rejected = await run(sandbox.path, ['check', '--staged', '--json']);
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
        const findings = (JSON.parse(rejected.stdout) as RunReport).checks.flatMap((check) => check.findings);
        expect(recorded(findings)).toStrictEqual(recorded(example.findings));
        for (const path of example.fix.deleted) rmSync(join(sandbox.path, path));
        await createFileTree(
            sandbox.path,
            Object.fromEntries(example.fix.files.map((file) => [file.path, file.content])),
        );
        expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
        const passed = await run(sandbox.path, ['check', '--staged', '--json']);
        expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    },
    INSTALL_TIMEOUT_MS,
);
