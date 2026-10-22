import { join } from 'node:path';
import { testdir } from 'testdirs';
import { rm } from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import { LOCKED_SCOPE_SETTINGS } from '#tests/config/checks/language/python/pip-installs.ts';

test.each([...LOCKFILES.filter(({ packageManager }) => ['uv', 'poetry', 'pdm'].includes(packageManager))])(
    'a requirements file is reported only in a scope with a $file lockfile and passes once removed',
    async ({ file }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['python'], LOCKED_SCOPE_SETTINGS),
            'requirements.txt': 'root-dependency\n',
            [`locked/${file}`]: 'version = 1\n',
            'locked/requirements.txt': 'duplicated-dependency\n',
            'locked/main.py': 'value = 1\n',
            'other/requirements.txt': 'unlocked-dependency\n',
            'other/main.py': 'value = 2\n',
        });

        const checked = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['python/pip-installs'] }),
        );

        const report = checked.report;
        expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
            { file: 'locked/requirements.txt', rule: 'requirements-file' },
        ]);
        expect(report.checks.filter((check) => check.status === 'failed').map((check) => check.scope)).toStrictEqual([
            'locked',
        ]);
        await rm(join(sandbox.path, 'locked/requirements.txt'));
        const corrected = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['python/pip-installs'] }),
        );

        expect(corrected.report.checks.flatMap((check) => check.findings)).toStrictEqual([]);
    },
);
