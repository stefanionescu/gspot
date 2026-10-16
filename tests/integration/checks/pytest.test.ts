import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { COVERAGE_ZERO_LIMITS } from '#tests/data/checks/coverage.ts';
import { PYTEST_PYPROJECT } from '#tests/data/checks/python/project.ts';
import { PYTEST_CASES, PYTEST_SANDBOX } from '#tests/data/checks/pytest.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { runCheckSample, expectedSummary, summarizeSample } from '#tests/setup/sample-checks.ts';

const installedSandbox = registerSharedSandbox({
    ...PYTEST_SANDBOX,
    async before(root) {
        const installed = await runCommand(['uv', 'sync'], { cwd: root });
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    },
});

for (const entry of PYTEST_CASES) {
    test(`${entry.check} reports the required coverage and passes after the fix`, async () => {
        const result = await runCheckSample(installedSandbox(), entry, PYTEST_SANDBOX);
        expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
    });
}

test.each([80, 0])(
    "pytest/coverage with a %i limit uses the project's Python and needs pytest-cov only above 0",
    async (limit) => {
        const { root, environment } = installedSandbox();
        const project = PYTEST_PYPROJECT.replace(', "pytest-cov==7.1.0"', '');
        const change = await updateSandbox(
            { root, environment: {}, run: spawnGspot },
            {
                check: 'pytest/coverage',
                files: {
                    'pyproject.toml': project,
                    'uv.lock': await Bun.file(join(root, 'uv.lock')).text(),
                    'app/test_child.py': 'def test_child():\n    assert 3 * 2 == 6\n',
                    'gspot.toml': buildSettingsText(['python', 'pytest'], {
                        level: 'all',
                        tables:
                            (limit === 0
                                ? COVERAGE_ZERO_LIMITS
                                : COVERAGE_ZERO_LIMITS.replace(/^lines = .*$/mu, 'lines = 80')) +
                            `[[scope]]
path = "app"
configurations = ["python", "pytest"]
`,
                    }),
                },
            },
        );
        try {
            const installed = await runCommand(['uv', 'sync'], { cwd: root, env: environment });
            expect(installed.code, installed.stdout + installed.stderr).toBe(0);
            const lockfile = await Bun.file(join(root, 'uv.lock')).text();
            const checked = await spawnGspot(root, ['check', '--only', 'pytest/coverage', '--json'], environment);
            expect(checked.code, checked.stdout + checked.stderr).toBe(limit === 0 ? 0 : 2);
            const checks = (JSON.parse(checked.stdout) as RunReport).checks;
            expect(checks.map((check) => check.scope)).toStrictEqual(['', 'app']);
            for (const check of checks) {
                expect(check.status).toBe(limit === 0 ? 'passed' : 'missing');
                if (limit === 0) expect(check.command?.some((arg) => arg.startsWith('--cov'))).toBe(false);
                else expect(check.note).toContain('pytest-cov');
            }
            expect(await Bun.file(join(root, 'pyproject.toml')).text()).toBe(project);
            expect(await Bun.file(join(root, 'uv.lock')).text()).toBe(lockfile);
        } finally {
            await change[Symbol.asyncDispose]();
            const restored = await runCommand(['uv', 'sync'], { cwd: root, env: environment });
            expect(restored.code, restored.stdout + restored.stderr).toBe(0);
        }
    },
);
