import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { getConfigFilePath } from '#tests/setup/cli/generated-files.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { GENERATED_BASH_FILES } from '#tests/config/checks/general/gspot/generated-files.ts';

test('gspot/generated-files reports an edited file with the apply help and passes after apply, while tool lockfiles stay missing', async () => {
    await using sandbox = await testdir(GENERATED_BASH_FILES);

    await applyGeneratedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    const shellcheckrc = getConfigFilePath(session, 'shellcheckrc');
    const initial = await runChecks(session, buildRunOptions({ only: ['gspot/generated-files'] }));
    const missingLocks = initial.report.checks[0]!.findings;
    expect(missingLocks).toMatchObject([
        { file: GSPOT_PATHS.miseLockfile, rule: 'missing', help: 'Run gspot install.' },
        { file: `${GSPOT_FOLDER}/package-lock.json`, rule: 'missing', help: 'Run gspot install.' },
        { file: GSPOT_PATHS.uvLockfile, rule: 'missing', help: 'Run gspot install.' },
    ]);
    const generated = await readFile(join(sandbox.path, shellcheckrc), 'utf8');
    await writeFile(join(sandbox.path, shellcheckrc), `${generated}disable=SC2034\n`);
    const edited = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['gspot/generated-files'] }),
    );

    expect(edited.report.checks[0]?.findings.filter(({ file }) => file === shellcheckrc)).toMatchObject([
        {
            file: shellcheckrc,
            rule: 'changed',
            message: 'This generated file is out of date.',
            help: 'Run gspot apply.',
        },
    ]);
    await applyGeneratedFiles(sandbox.path);
    const repaired = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['gspot/generated-files'] }),
    );
    expect(repaired.report.checks[0]).toMatchObject({ status: 'failed', findings: missingLocks });
});

test('gspot/generated-files reports a removed configuration file as stray with delete help', async () => {
    await using sandbox = await testdir(GENERATED_BASH_FILES);
    await applyGeneratedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    const path = getConfigFilePath(session, 'shellcheckrc');
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([]));
    const findings = await runSandboxCheck(sandbox.path, 'gspot/generated-files');
    expect(findings.filter((finding) => finding.file === path)).toStrictEqual([
        {
            check: 'gspot/generated-files',
            file: path,
            rule: 'stray',
            fixable: false,
            message: 'gspot wrote this file, and no selected configuration writes it now.',
            help: 'Run gspot apply to delete it.',
        },
    ]);
});
