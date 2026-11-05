import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { GENERATED_BASH_FILES } from '#tests/config/configurations/gspot/files.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { getConfigPath } from '#tests/setup/cli/generated-files.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('gspot/generated-files reports an edited file with the install help and passes after a write, while tool lockfiles stay missing', async () => {
    await using sandbox = await createGitSandbox(GENERATED_BASH_FILES);

    await applyGeneratedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    const shellcheckrc = getConfigPath(session, 'shellcheckrc');
    const initial = await runChecks(session, buildRunOptions({ only: ['gspot/generated-files'] }));
    const missingLocks = initial.report.checks[0]!.findings;
    expect(missingLocks).toMatchObject([
        { file: GSPOT_PATHS.miseLockfile, rule: 'absent' },
        { file: `${GSPOT_FOLDER}/package-lock.json`, rule: 'absent' },
    ]);
    const generated = await readFile(join(sandbox.path, shellcheckrc), 'utf8');
    await writeFile(join(sandbox.path, shellcheckrc), `${generated}disable=SC2034\n`);
    const edited = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['gspot/generated-files'] }),
    );

    expect(edited.report.checks[0]?.findings.filter(({ file }) => file === shellcheckrc)).toMatchObject([
        { file: shellcheckrc, rule: 'changed' },
    ]);
    await applyGeneratedFiles(sandbox.path);
    const repaired = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['gspot/generated-files'] }),
    );
    expect(repaired.report.checks[0]).toMatchObject({ status: 'failed', findings: missingLocks });
});

test('gspot/generated-files reports a removed configuration file as stray with delete help', async () => {
    await using sandbox = await createGitSandbox(GENERATED_BASH_FILES);
    await applyGeneratedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    const path = getConfigPath(session, 'shellcheckrc');
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings([]));
    const findings = await runSandboxCheck(sandbox.path, 'gspot/generated-files');
    expect(findings.filter((finding) => finding.file === path).map(({ file, rule }) => ({ file, rule }))).toStrictEqual(
        [{ file: path, rule: 'stray' }],
    );
});
