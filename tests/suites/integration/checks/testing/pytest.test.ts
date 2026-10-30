import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runCommand } from '#tests/setup/system/processes.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

import {
    PYTEST_CASES,
    PYTEST_SANDBOX,
    PYTEST_PYPROJECT,
    COVERAGE_LIMIT_CASES,
} from '#tests/config/integration/checks/testing/testing.ts';

const installedSandbox = shareInstalledSandbox({ install: false, ...PYTEST_SANDBOX, commands: [['uv', 'sync']] });

test.each([...PYTEST_CASES])('$check reports the required coverage and passes after the fix', async (sample) => {
    await assertCheckSample(installedSandbox(), sample);
});

test.each([...COVERAGE_LIMIT_CASES])(
    "pytest/coverage with a $limit limit uses the project's Python and needs pytest-cov only above 0",
    async ({ coverage, code, result }) => {
        const { root } = installedSandbox();
        const project = PYTEST_PYPROJECT.replace(', "pytest-cov==7.1.0"', '');
        const change = await writeSandboxChanges(installedSandbox(), {
            files: {
                'pyproject.toml': project,
                'uv.lock': await readFile(join(root, 'uv.lock'), 'utf8'),
                'app/test_child.py': 'def test_child():\n    assert 3 * 2 == 6\n',
                'gspot.toml': buildSandboxSettings(['python', 'pytest'], {
                    level: 'all',
                    scopes: [{ path: 'app', configurations: ['python', 'pytest'] }],
                    tables: coverage,
                }),
            },
        });
        try {
            const installed = await runCommand(['uv', 'sync'], { cwd: root });
            expect(installed.code, installed.stdout + installed.stderr).toBe(0);
            const lockfile = await readFile(join(root, 'uv.lock'), 'utf8');
            const checked = parseCheckReport(await spawnGspot(root, ['check', '--only', 'pytest/coverage', '--json']));
            expect(checked.code, checked.stdout + checked.stderr).toBe(code);
            expect(
                checked.report.checks.map(({ scope, status, note, command }) => ({
                    scope,
                    status,
                    note,
                    coverage: command?.some((argument) => argument.startsWith('--cov')),
                })),
            ).toStrictEqual(['', 'app'].map((scope) => ({ scope, ...result })));
            expect(await readFile(join(root, 'pyproject.toml'), 'utf8')).toBe(project);
            expect(await readFile(join(root, 'uv.lock'), 'utf8')).toBe(lockfile);
        } finally {
            await change[Symbol.asyncDispose]();
            const restored = await runCommand(['uv', 'sync'], { cwd: root });
            expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        }
    },
);
