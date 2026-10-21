import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { applySandboxChanges, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { RUFF_SANDBOX, VERSION_SOURCE, RUFF_VERSION_CASES } from '#tests/data/checks/python/tool-checks.ts';

const installedSandbox = registerSharedSandbox(RUFF_SANDBOX);

test("Ruff fixes follow each scope's minimum Python version", async () => {
    const { root } = installedSandbox();
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
    const sourceFiles = { 'gspot.toml': buildSandboxSettings(['python'], { level: 'all', tables }), ...files };
    await using _sourceChange = await applySandboxChanges(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
    );

    const command = ['check', '--only', 'python/ruff', '--json'];
    const checked = parseCheckReport(await spawnGspot(root, command));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = checked.report;
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
    const fixed = parseCheckReport(await spawnGspot(root, [...command, '--fix']));
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(1);
    const fixedReport = fixed.report;
    for (const { scope, annotation } of RUFF_VERSION_CASES) {
        const text = await readFile(join(root, scope, 'sample.py'), 'utf8');
        expect(text, scope).toContain(annotation);
        const result = fixedReport.checks.find((entry) => entry.scope === scope)!;
        expect(result.status, scope).toBe(scope === 'modern' ? 'passed' : 'failed');
        expect(
            result.findings.every(({ fixable }) => !fixable),
            scope || 'root',
        ).toBe(true);
    }
});
