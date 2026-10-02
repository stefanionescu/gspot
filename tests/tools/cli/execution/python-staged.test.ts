// A staged Python defect is reported from the working tree's installed environment against the snapshot.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gitOutput } from '#tests/harness/cli/git.ts';
import { openSession } from '#cli/execution/session.ts';
import { emitted } from '#tests/harness/cli/generated.ts';
import { onPosix } from '#tests/harness/cli/platforms.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { installPythonProject } from '#cli/tools/python.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { runOwnedLifecycle } from '#cli/lifecycle/ownership/owner.ts';
import { createPythonRegistry } from '#tests/harness/registry/python.ts';
import { preparePythonInstallation } from '#tests/harness/tools/python.ts';

// A Windows virtual environment has launchers and no interpreter links; the install tests stay POSIX-only.

if (onPosix)
    test('a staged Python defect is reported by Ruff from the installed environment while the working tree differs', async () => {
        await using repository = await testdir();
        await using artifacts = await testdir();
        await using registry = await createPythonRegistry(artifacts.path);
        await using prepared = await preparePythonInstallation(repository.path, 'pyproject.toml', 'none', registry.url);
        await runOwnedLifecycle(prepared.root, (owner) => installPythonProject(prepared.root, owner));
        // The fixture installs Ruff alone, so only its generated configuration is written and committed.
        const session = await openSession(repository.path);
        const generated = emitted(session).files.filter((file) => file.path.startsWith('.gspot/config/ruff'));
        mkdirSync(join(repository.path, '.gspot/config'), { recursive: true });
        for (const file of generated) writeFileSync(join(repository.path, file.path), file.content);
        for (const args of [
            ['init', '--quiet'],
            ['add', '--all'],
            ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Fixture'],
        ])
            gitOutput(repository.path, args);
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
    }, 180_000);
