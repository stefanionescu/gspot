import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { findConfigFilePath } from '#tests/setup/cli/generated-files.ts';

test('gspot/generated-files reports an edited file with the apply help and passes after apply, while tool lockfiles stay missing', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': '#!/usr/bin/env bash\necho ok\n',
        '.gitignore': `${GSPOT_PATHS.state}/\n`,
    });

    await applyGeneratedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    const shellcheckrc = findConfigFilePath(session, 'shellcheckrc');
    const initial = await runChecks(session, buildRunOptions({ only: ['gspot/generated-files'] }));
    const missingLocks = initial.report.checks[0]!.findings;
    expect(missingLocks).toMatchObject([
        { file: GSPOT_PATHS.miseLockfile, rule: 'missing' },
        { file: `${GSPOT_FOLDER}/package-lock.json`, rule: 'missing' },
        { file: GSPOT_PATHS.uvLockfile, rule: 'missing' },
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
            message: 'This generated file differs from what gspot.toml generates.',
            help: 'Run gspot apply to write it again; to change what it holds, change gspot.toml.',
        },
    ]);
    await applyGeneratedFiles(sandbox.path);
    const repaired = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['gspot/generated-files'] }),
    );
    expect(repaired.report.checks[0]).toMatchObject({ status: 'failed', findings: missingLocks });
});
