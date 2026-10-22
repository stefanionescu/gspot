import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { generate } from '#cli/generation/generate.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { SHELLCHECK_RC } from '#tests/data/checks/gspot/generated-files.ts';

test('gspot/generated-files reports an edited file with the apply help and passes after apply, while tool lockfiles stay missing', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'run.sh': '#!/usr/bin/env bash\necho ok\n',
        '.gitignore': '.gspot/state/\n',
    });

    {
        const session = await openSession(sandbox.path);
        using writer = openWriter(sandbox.path);
        writeGeneratedFiles(session, generate(session), writer);
    }
    const initial = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['gspot/generated-files'] }),
    );
    const missingLocks = initial.report.checks[0]!.findings;
    expect(missingLocks).toMatchObject([
        { file: '.gspot/package-lock.json', rule: 'missing' },
        { file: '.gspot/uv.lock', rule: 'missing' },
    ]);
    const generated = await readFile(join(sandbox.path, SHELLCHECK_RC), 'utf8');
    await writeFile(join(sandbox.path, SHELLCHECK_RC), `${generated}disable=SC2034\n`);
    const edited = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['gspot/generated-files'] }),
    );

    expect(edited.report.checks[0]?.findings.filter(({ file }) => file === SHELLCHECK_RC)).toMatchObject([
        {
            file: SHELLCHECK_RC,
            rule: 'changed',
            message: 'This generated file differs from what gspot.toml generates.',
            help: 'Change settings in gspot.toml, then run gspot apply. gspot replaces the generated files that it owns.',
        },
    ]);
    {
        const session = await openSession(sandbox.path);
        using writer = openWriter(sandbox.path);
        writeGeneratedFiles(session, generate(session), writer);
    }
    const repaired = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['gspot/generated-files'] }),
    );
    expect(repaired.report.checks[0]).toMatchObject({ status: 'failed', findings: missingLocks });
});
