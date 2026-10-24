import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { readFile, writeFile } from 'node:fs/promises';
import type { RunReport } from '#cli/types/runs/run.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { ruffRulesSchema, ruffConfigurationSchema } from '#tests/schemas/ruff.ts';
import { RUFF_SANDBOX } from '#tests/config/integration/checks/language/python/samples.ts';
import { spawnGspot, listFindingRows, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { applySandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';

import {
    PYTEST_SAMPLE,
    VERSION_SOURCE,
    RUFF_RULE_SOURCE,
    RUFF_FORMAT_CASES,
    RUFF_VERSION_CASES,
    RUFF_RULE_ARGUMENTS,
    UNUSED_IMPORT_SOURCE,
    RUFF_FORMAT_ARGUMENTS,
} from '#tests/config/integration/checks/language/python/ruff.ts';

async function assertPytestSelection(root: string, sample: string): Promise<void> {
    const unselected = await spawnGspot(root, ['check', 'tests/test_example.py', '--only', 'python/ruff', '--json']);
    expect(unselected.code, unselected.stdout + unselected.stderr).toBe(0);
    const failed = parseCheckReport(
        await spawnGspot(root, ['check', 'app/tests/test_example.py', '--only', 'python/ruff', '--json']),
    );
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(listFindingRows(failed.report)).toStrictEqual([
        { file: 'app/tests/test_example.py', line: 6, rule: 'PT001' },
    ]);
    await writeFile(join(root, 'app/tests/test_example.py'), sample.replace('@pytest.fixture()', '@pytest.fixture'));
    const corrected = await spawnGspot(root, ['check', 'app/tests/test_example.py', '--only', 'python/ruff', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
}

async function assertIgnoreScope(root: string): Promise<void> {
    for (const path of ['tests/test_example.py', 'app/tests/test_example.py'])
        await writeFile(
            join(root, path),
            `"""An assertion example."""

assert True
`,
        );
    const rootAssertion = parseCheckReport(
        await spawnGspot(root, ['check', 'tests/test_example.py', '--only', 'python/ruff', '--json']),
    );
    expect(rootAssertion.code, rootAssertion.stderr).toBe(1);
    expect(listFindingRows(rootAssertion.report)).toStrictEqual([
        { file: 'tests/test_example.py', line: 3, rule: 'S101' },
    ]);
    const testAssertion = await spawnGspot(root, [
        'check',
        'app/tests/test_example.py',
        '--only',
        'python/ruff',
        '--json',
    ]);
    expect(testAssertion.code, testAssertion.stderr).toBe(0);
}

const installedSandbox = shareInstalledSandbox(RUFF_SANDBOX);

test('Ruff selects the pytest lint rules only in the scope that selects pytest, and an S101 ignore on app/tests stays in that scope', async () => {
    const { root } = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['pytest'] }],
            tables: '[[ignore]]\ncheck = "python/ruff"\nrule = "S101"\npaths = ["app/tests/**"]\nreason = "Test assertions deliberately verify the behavior."\n',
        }),
        'tests/__init__.py': '"""Root test package."""\n',
        'app/__init__.py': '"""Application package."""\n',
        'app/tests/__init__.py': '"""Application test package."""\n',
        'tests/test_example.py': PYTEST_SAMPLE,
        'app/tests/test_example.py': PYTEST_SAMPLE,
    };
    await using _sourceChange = await applySandboxChanges(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
    );

    await assertPytestSelection(root, PYTEST_SAMPLE);
    await assertIgnoreScope(root);
});

test.each([...LEVELS])(
    'Ruff at level %s selects no preview rule, reports correctness, and reports print calls only at level all',
    async (level) => {
        const { root } = installedSandbox();
        const sourceFiles = {
            'gspot.toml': buildSandboxSettings(['python'], { level }),
            'sample.py': RUFF_RULE_SOURCE,
        };
        await using _sourceChange = await applySandboxChanges(
            installedSandbox(),
            buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
        );

        const resultRules = runCommandBlocking(
            [buildVenvExecutablePath(join(root, GSPOT_PATHS.pythonEnvironment), 'ruff'), ...RUFF_RULE_ARGUMENTS],
            { cwd: root },
        );
        expect(resultRules.code, resultRules.stdout + resultRules.stderr).toBe(0);
        const rules = ruffRulesSchema.parse(JSON.parse(resultRules.stdout));
        const previewCodes = new Set(rules.flatMap(({ code, preview }) => (code !== null && preview ? code : [])));
        const command = ['check', 'sample.py', '--only', 'python/ruff', '--json'];
        const ruffText = await readFile(join(root, findManifestTarget('python', 'ruff.toml')), 'utf8');
        const contents: unknown = parse(ruffText);
        const config = ruffConfigurationSchema.parse(contents);
        expect(config.lint.select.filter((code) => previewCodes.has(code))).toStrictEqual([]);
        const result = parseCheckReport(await spawnGspot(root, command));
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(listFindingRows(result.report)).toStrictEqual([
            { file: 'sample.py', line: 3, rule: 'F821' },
            ...(level === 'all' ? [{ file: 'sample.py', line: 4, rule: 'T201' }] : []),
        ]);
        await writeFile(
            join(root, 'sample.py'),
            `"""An arithmetic example."""

answer = 42
`,
        );
        const corrected = await spawnGspot(root, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

test('Ruff run by an editor and through gspot formats each scope the same way', async () => {
    const { root } = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['python'], {
            scopes: [{ path: 'app' }],
            tables: '[format]\nquotes = "single"\nline_ending = "crlf"\n\n[scope.format]\nquotes = "double"\nline_ending = "lf"\n',
        }),
        'sample.py': 'VALUE = "example"\n',
        'app/sample.py': 'VALUE = "example"\n',
    };
    await using _sourceChange = await applySandboxChanges(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
    );

    for (const { file, formatted } of RUFF_FORMAT_CASES) {
        const fixed = await spawnGspot(root, ['check', file, '--only', 'python/ruff-format', '--fix', '--json']);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await readFile(join(root, file), 'utf8')).toBe(formatted);
        const editor = runCommandBlocking(
            [
                buildVenvExecutablePath(join(root, GSPOT_PATHS.pythonEnvironment), 'ruff'),
                ...RUFF_FORMAT_ARGUMENTS,
                file,
            ],
            { cwd: root, env: {} },
        );
        expect(editor.code, editor.stdout + editor.stderr).toBe(0);
    }
});

test('Ruff alone reports an unused import, and basedpyright still reports the type error', async () => {
    const { root } = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
        'sample.py': UNUSED_IMPORT_SOURCE,
    };
    await using _sourceChange = await applySandboxChanges(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
    );

    const command = ['check', '--only', 'python/ruff,python/basedpyright', '--json'];
    const checked = parseCheckReport(await spawnGspot(root, command));
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect(
        checked.report.checks.flatMap(({ findings }) =>
            findings.map(({ check, file, line, rule }) => ({ check, file, line, rule })),
        ),
    ).toStrictEqual([
        { check: 'python/ruff', file: 'sample.py', line: 3, rule: 'F401' },
        { check: 'python/basedpyright', file: 'sample.py', line: 5, rule: 'reportAssignmentType' },
    ]);
    await writeFile(
        join(root, 'sample.py'),
        `"""An example module."""

TOTAL: int = 1
`,
    );
    const corrected = await spawnGspot(root, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

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

function listScopeRules(report: RunReport): Record<string, { status: string; rules: readonly (string | undefined)[] }> {
    return Object.fromEntries(
        report.checks.map(({ scope, status, findings }) => [
            scope,
            { status, rules: findings.map(({ rule }) => rule) },
        ]),
    );
}
