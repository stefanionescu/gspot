// A staged Python defect is reported from the working tree's installed environment against the snapshot.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { openSession } from '#cli/commands/session.ts';
import { installTools } from '#cli/lifecycle/install.ts';
import { containing } from '#tests/harness/expectations.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { preparePythonInstallation } from '#tests/harness/python-installation.ts';

// A Windows virtual environment has launchers and no interpreter links; the install tests stay POSIX-only.

test.skipIf(!isPosix)(
    'a staged Python defect is reported by Ruff from the installed environment while the working tree differs',
    async () => {
        await using repository = await testdir();
        await using prepared = await preparePythonInstallation(repository.path, {
            indexFile: 'pyproject.toml',
            runner: 'none',
        });
        {
            using log = openOwnership(prepared.root);
            const installed = await installTools(await openSession(prepared.root), log, { refreshLocks: false });
            expect(installed.exitCode, installed.note).toBe(0);
        }
        // Public apply already generated the Ruff configuration before tool installation.
        commitAll(repository.path);
        // The index holds a second defect beside the committed one; the working tree has the correction.
        writeFileSync(join(repository.path, 'source.py'), 'import os\nimport sys\n');
        gitOutput(repository.path, ['add', 'source.py']);
        writeFileSync(join(repository.path, 'source.py'), 'VALUE = 1\n');
        const command = ['check', '--only', 'python/ruff', '--json'];
        const staged = await spawnGspot(repository.path, [...command, '--staged']);
        expect(staged.code, staged.stdout + staged.stderr).toBe(1);
        const report = JSON.parse(staged.stdout) as RunReport;
        expect(report.checks).toMatchObject([
            {
                check: 'python/ruff',
                status: 'failed',
                findings: [
                    containing({ file: 'source.py', line: 1, rule: 'F401' }),
                    containing({ file: 'source.py', line: 2, rule: 'F401' }),
                ],
            },
        ]);
        const working = await spawnGspot(repository.path, command);
        expect(working.code, working.stdout + working.stderr).toBe(0);
        expect((JSON.parse(working.stdout) as RunReport).checks).toMatchObject([
            { check: 'python/ruff', status: 'passed' },
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
