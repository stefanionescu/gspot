import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { CHECKS } from '#cli/checks/registry.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { lockArgv } from '#cli/tools/npm/install.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { gspotDrift } from '#cli/checks/general/gspot.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { parseToolProject } from '#cli/parsers/packages.ts';
import { UV_LOCK_ARGUMENTS } from '#cli/config/tools/python.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { GENERATED } from '#tests/config/cli/checks/generated-drift.ts';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const GENERATED_DRIFT_OPTIONS = buildRunOptions({ only: ['gspot/drift'] });

test('an edited generated file and one holding merge markers are drift findings, and a fresh apply clears them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
        'run.sh': '#!/usr/bin/env bash\necho ok\n',
        '.gitignore': '.gspot/state/\n',
    });
    {
        using log = openOwnership(sandbox.path);
        writeOutputs(await openSession(sandbox.path), log);
    }
    const project = parseToolProject(readFileSync(join(sandbox.path, '.gspot/package.json'), 'utf8'));
    for (const command of [lockArgv(project.installer), ['uv', ...UV_LOCK_ARGUMENTS, '--no-python-downloads']]) {
        const prepared = await runTestCommand(command, { cwd: join(sandbox.path, '.gspot') });
        expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    }
    expect(existsSync(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    expect(existsSync(join(sandbox.path, '.gspot/.venv'))).toBe(false);
    const clean = await executeRun(await openSession(sandbox.path), { ...GENERATED_DRIFT_OPTIONS, checks: CHECKS });
    expect(clean.report.checks).toMatchObject([{ check: 'gspot/drift', status: 'passed', findings: [] }]);
    const rendered = readFileSync(join(sandbox.path, GENERATED), 'utf8');
    // Generated files are read-only; the edits below stand for a developer who forced one through.
    chmodSync(join(sandbox.path, GENERATED), 0o644);
    writeFileSync(join(sandbox.path, GENERATED), `${rendered}disable=SC2034\n`);
    const edited = await executeRun(await openSession(sandbox.path), { ...GENERATED_DRIFT_OPTIONS, checks: CHECKS });
    expect(edited.report.exitCode).toBe(1);
    expect(edited.report.checks[0]?.findings).toMatchObject([
        { file: GENERATED, rule: 'changed', help: textContaining('gspot apply') },
    ]);
    writeFileSync(
        join(sandbox.path, GENERATED),
        `<<<<<<< HEAD\n${rendered}=======\n${rendered}disable=SC2034\n>>>>>>> feature\n`,
    );
    const conflicted = await executeRun(await openSession(sandbox.path), {
        ...GENERATED_DRIFT_OPTIONS,
        checks: CHECKS,
    });
    expect(conflicted.report.checks[0]?.findings).toMatchObject([
        {
            file: GENERATED,
            rule: 'conflict',
            message: textContaining('merge conflict markers'),
            help: 'Run gspot apply to write the file again, then gspot install to install what it records.',
        },
    ]);
    {
        using log = openOwnership(sandbox.path);
        writeOutputs(await openSession(sandbox.path), log);
    }
    const repaired = await executeRun(await openSession(sandbox.path), { ...GENERATED_DRIFT_OPTIONS, checks: CHECKS });
    expect(repaired.report.checks[0]).toMatchObject({ status: 'passed', findings: [] });
});

test('the drift runner rejects a manifest that does not run once', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }),
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, GENERATED_DRIFT_OPTIONS)[0]!;
    expect(planned.spec.runs).toBe('once');
    expect(() => gspotDrift(session, { ...planned, spec: { ...planned.spec, runs: 'scope' } })).toThrow(
        'The gspot/drift check needs generated file comparisons, so its manifest must say runs = "once".',
    );
});
