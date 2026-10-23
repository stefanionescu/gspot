import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import type { RunReport } from '#cli/types/runs/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { RUFF_SANDBOX } from '#tests/config/integration/checks/language/python/samples.ts';
import { applySandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { VERSION_SOURCE, RUFF_VERSION_CASES } from '#tests/config/integration/checks/language/python/versions.ts';

const installedSandbox = shareInstalledSandbox(RUFF_SANDBOX);

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
    expect(listScopeRules(checked.report)).toStrictEqual(
        Object.fromEntries(RUFF_VERSION_CASES.map(({ scope, rules }) => [scope, { status: 'failed', rules }])),
    );
    const fixed = parseCheckReport(await spawnGspot(root, [...command, '--fix']));
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(1);
    expect(listScopeRules(fixed.report)).toStrictEqual({
        '': { status: 'failed', rules: ['FA100', 'FA100', 'FA100', 'FA100'] },
        legacy: { status: 'failed', rules: ['UP035', 'FA100', 'UP006', 'FA100', 'UP006'] },
        modern: { status: 'passed', rules: [] },
    });
    const sources = await Promise.all(
        RUFF_VERSION_CASES.map(async ({ scope }) => await readFile(join(root, scope, 'sample.py'), 'utf8')),
    );
    expect(sources).toStrictEqual(RUFF_VERSION_CASES.map(({ fixed: source }) => source));
});

/** Map each scope of a report to its status and the rules of its findings. */
function listScopeRules(report: RunReport): Record<string, { status: string; rules: readonly (string | undefined)[] }> {
    return Object.fromEntries(
        report.checks.map(({ scope, status, findings }) => [
            scope,
            { status, rules: findings.map(({ rule }) => rule) },
        ]),
    );
}
