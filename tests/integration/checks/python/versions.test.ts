import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { runSandboxStep } from '#tests/setup/install.ts';
import type { RunReport } from '#cli/types/runs/check.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { RUFF_SANDBOX, VERSION_SOURCE, RUFF_VERSION_CASES } from '#tests/data/checks/python/tool-checks.ts';

const installedSandbox = registerSharedSandbox(RUFF_SANDBOX);

test("Ruff fixes follow each scope's minimum Python version", async () => {
    const sandbox = { path: installedSandbox().root };
    const tables = RUFF_VERSION_CASES.filter(({ scope }) => scope !== '')
        .map(({ scope }) => `[[scope]]\npath = "${scope}"\n`)
        .join('');
    const files = Object.fromEntries(
        RUFF_VERSION_CASES.flatMap(({ scope, requires }) => [
            [
                join(scope, 'pyproject.toml'),
                `[project]
name = "version-example"
version = "1.0.0"
requires-python = "${requires}"
`,
            ],
            [join(scope, 'sample.py'), VERSION_SOURCE],
        ]),
    );
    const sourceFiles = { 'gspot.toml': buildSettingsText(['python'], { level: 'all', tables }), ...files };
    await using _sourceChange = await updateSandbox(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
    );
    await runSandboxStep(sandbox.path, ['apply'], {}, 'apply');
    const command = ['check', '--only', 'python/ruff', '--json'];
    const checked = await spawnGspot(sandbox.path, command);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = JSON.parse(checked.stdout) as RunReport;
    for (const { scope, generics, unions } of RUFF_VERSION_CASES) {
        const found = report.checks.find((entry) => entry.scope === scope)!.findings;
        expect(
            found.some(({ rule }) => rule === 'UP006'),
            scope || 'root',
        ).toBe(generics);
        expect(
            found.some(({ rule }) => rule === 'UP045'),
            scope || 'root',
        ).toBe(unions);
    }
    const fixed = await spawnGspot(sandbox.path, [...command, '--fix']);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(1);
    const fixedReport = JSON.parse(fixed.stdout) as RunReport;
    for (const { scope, annotation } of RUFF_VERSION_CASES) {
        const text = await Bun.file(join(sandbox.path, scope, 'sample.py')).text();
        expect(text, scope).toContain(annotation);
        const result = fixedReport.checks.find((entry) => entry.scope === scope)!;
        expect(result.status, scope).toBe(scope === 'modern' ? 'passed' : 'failed');
        expect(
            result.findings.every(({ fixable }) => !fixable),
            scope || 'root',
        ).toBe(true);
    }
});
