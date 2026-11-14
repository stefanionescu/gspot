import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { RunReport } from '#cli/types/engine/run.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildVenvExecutablePath } from '#tests/setup/cli/tools.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { createPythonProject } from '#tests/setup/sandboxes/projects/python.ts';
import { runCommand, runBlockingCommand } from '#tests/setup/system/processes.ts';
import { buildSandboxChanges, writeSandboxChanges } from '#tests/setup/sandboxes/changes.ts';
import { spawnGspot, listFindingRows, parseCheckReport, readSuppressionResults } from '#tests/setup/cli/commands.ts';

import {
    RUFF_SANDBOX,
    PYTEST_SAMPLE,
    VERSION_SOURCE,
    RUFF_SUPPRESSIONS,
    RUFF_VERSION_CASES,
    UNUSED_IMPORT_SOURCE,
    RUFF_PARAMETER_LIMIT_CASE,
} from '#tests/config/integration/python.ts';

const installedSandbox = shareInstalledSandbox(RUFF_SANDBOX);

function listScopeRules(
    report: RunReport,
): Record<string, { status: string; rules: ReadonlyArray<string | undefined> }> {
    return Object.fromEntries(
        report.checks.map(({ scope, status, findings }) => [
            scope,
            { status, rules: findings.map(({ rule }) => rule) },
        ]),
    );
}

test.each(['basic', 'all'] as const)('Ruff reports a hardcoded secret only at level all: %s', async (level) => {
    const { root } = installedSandbox();
    await using _sourceChange = await writeSandboxChanges(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, {
            'gspot.toml': buildSandboxSettings(['python'], { level }),
            'settings.py': '"""Application settings."""\n\nSECRET_KEY = "development"\n',
        }),
    );
    const checked = parseCheckReport(
        await spawnGspot(root, ['check', 'settings.py', '--only', 'python/ruff', '--json']),
    );
    const rules = listFindingRows(checked.report).map(({ rule }) => rule);
    expect(rules.includes('S105'), checked.stdout).toBe(level === 'all');
});

test('Ruff selects the pytest lint rules only in the scope that selects pytest, and accepts an assert only in a test file', async () => {
    const { root } = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['pytest'] }],
        }),
        'tests/__init__.py': '"""Root test package."""\n',
        'app/__init__.py': '"""Application package."""\n',
        'app/tests/__init__.py': '"""Application test package."""\n',
        'tests/test_example.py': PYTEST_SAMPLE,
        'app/tests/test_example.py': PYTEST_SAMPLE,
    };
    await using _sourceChange = await writeSandboxChanges(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
    );

    const command = ['--only', 'python/ruff', '--json'];
    const failed = parseCheckReport(await spawnGspot(root, ['check', 'app/tests/test_example.py', ...command]));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(listFindingRows(failed.report)).toStrictEqual([
        { file: 'app/tests/test_example.py', line: 6, rule: 'PT001' },
    ]);
    await writeFile(
        join(root, 'app/tests/test_example.py'),
        PYTEST_SAMPLE.replace('@pytest.fixture()', '@pytest.fixture'),
    );
    const corrected = await spawnGspot(root, ['check', 'app/tests/test_example.py', ...command]);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    for (const path of ['app/__init__.py', 'app/tests/test_example.py'])
        await writeFile(join(root, path), '"""An assertion example."""\n\nassert True\n');
    const rootAssertion = parseCheckReport(await spawnGspot(root, ['check', 'app/__init__.py', ...command]));
    expect(rootAssertion.code, rootAssertion.stderr).toBe(1);
    expect(listFindingRows(rootAssertion.report)).toStrictEqual([{ file: 'app/__init__.py', line: 3, rule: 'S101' }]);
});

test('Ruff run by an editor and through gspot formats each scope the same way', async () => {
    const { root } = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['python'], {
            scopes: [{ path: 'app' }],
            tables: `[format]
quotes = "single"

[scope.format]
quotes = "double"
`,
        }),
        'sample.py': 'VALUE = "example"\n',
        'app/sample.py': 'VALUE = "example"\n',
    };
    await using _sourceChange = await writeSandboxChanges(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
    );

    const unformatted = parseCheckReport(
        await spawnGspot(root, ['check', 'sample.py', '--only', 'python/ruff-format', '--json']),
    );
    expect(
        unformatted.report.checks.flatMap(({ findings }) => findings.map(({ file, fixable }) => ({ file, fixable }))),
    ).toStrictEqual([{ file: 'sample.py', fixable: true }]);
    const ruff = buildVenvExecutablePath(join(root, GSPOT_PATHS.pythonEnvironment), 'ruff');
    const formats = [
        { file: 'sample.py', formatted: "VALUE = 'example'\n" },
        { file: 'app/sample.py', formatted: 'VALUE = "example"\n' },
    ];
    for (const { file, formatted } of formats) {
        const fixed = await spawnGspot(root, ['check', file, '--only', 'python/ruff-format', '--fix', '--json']);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await readFile(join(root, file), 'utf8')).toBe(formatted);
        const editor = runBlockingCommand([ruff, 'format', '--check', '--no-cache', file], { cwd: root, env: {} });
        expect(editor.code, editor.stdout + editor.stderr).toBe(0);
    }
});

test('Ruff alone reports an unused import, and basedpyright still reports the type error', async () => {
    const { root } = installedSandbox();
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
        'sample.py': UNUSED_IMPORT_SOURCE,
    };
    await using _sourceChange = await writeSandboxChanges(
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
    await using _sourceChange = await writeSandboxChanges(
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
        modern: { status: 'failed', rules: ['UP035', 'F401', 'F401'] },
    });
    const sources = await Promise.all(
        RUFF_VERSION_CASES.map(async ({ scope }) => await readFile(join(root, scope, 'sample.py'), 'utf8')),
    );
    expect(sources).toStrictEqual(RUFF_VERSION_CASES.map(({ fixed: source }) => source));
});

test('Ruff from the installed environment reports a staged Python finding while the working tree differs', async () => {
    await using sandbox = await createGitSandbox({});
    await using _project = await createPythonProject(sandbox.path, { indexFile: 'pyproject.toml' });
    const installed = await spawnGspot(sandbox.path, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    commitAll(sandbox.path);
    await writeFile(join(sandbox.path, 'source.py'), 'import os\nimport sys\n');
    runGitStep(sandbox.path, ['add', 'source.py']);
    await writeFile(join(sandbox.path, 'source.py'), 'VALUE = 1\n');
    const command = ['check', '--only', 'python/ruff', '--json'];
    const staged = parseCheckReport(await spawnGspot(sandbox.path, [...command, '--staged']));
    expect(staged.code, staged.stdout + staged.stderr).toBe(1);
    expect(staged.report.checks).toMatchObject([
        {
            check: 'python/ruff',
            status: 'failed',
            findings: [
                matchFields({ file: 'source.py', line: 1, rule: 'F401' }),
                matchFields({ file: 'source.py', line: 2, rule: 'F401' }),
            ],
        },
    ]);
    const working = parseCheckReport(await spawnGspot(sandbox.path, command));
    expect(working.code, working.stdout + working.stderr).toBe(0);
    expect(working.report.checks).toMatchObject([{ check: 'python/ruff', status: 'passed' }]);
});

test('Ruff reports a function past the default parameter limit', async () => {
    const { language, file, source, finding } = RUFF_PARAMETER_LIMIT_CASE;
    const { root } = installedSandbox();
    await using _sourceChange = await writeSandboxChanges(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, {
            'gspot.toml': buildSandboxSettings([language], { level: 'all' }),
            [file]: source,
        }),
    );
    const result = parseCheckReport(await spawnGspot(root, ['check', file, '--only', 'python/ruff', '--json']));
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(listFindingRows(result.report).filter(({ rule }) => rule === finding.rule)).toStrictEqual([
        { file, ...finding },
    ]);
});

test('suppression detection agrees with Ruff on every noqa comment form and place', async () => {
    const { root } = installedSandbox();
    const paths = RUFF_SUPPRESSIONS.map((_, index) => `source_${String(index)}.py`);
    const sources = Object.fromEntries(RUFF_SUPPRESSIONS.map(({ source }, index) => [paths[index]!, source]));
    await using _sourceChange = await writeSandboxChanges(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, {
            'gspot.toml': buildSandboxSettings(['python'], { level: 'all' }),
            ...sources,
        }),
    );
    const ruff = buildVenvExecutablePath(join(root, GSPOT_PATHS.pythonEnvironment), 'ruff');
    const toolResult = await runCommand(
        [ruff, 'check', '--isolated', '--select', 'F401', '--output-format', 'json', ...paths],
        { cwd: root, env: {} },
    );
    expect(toolResult.code, toolResult.stdout + toolResult.stderr).toBe(1);
    const reported = new Set(
        (JSON.parse(toolResult.stdout) as Array<Record<'filename', string>>).map(({ filename }) => basename(filename)),
    );
    expect(await readSuppressionResults(root, paths, reported)).toStrictEqual(
        RUFF_SUPPRESSIONS.map(({ source, suppressed, directive }, index) => ({
            path: paths[index]!,
            suppressed,
            directives: directive && !source.includes('# reason:') ? [{ line: 1, rule: 'ruff-no-reason' }] : [],
        })),
    );
});

test('--fix keeps a side-effect import, and a suppression at level basic', async () => {
    const { root } = installedSandbox();
    const source = 'import readline\n\nVALUE = 1  # noqa: E501\n';
    await using _sourceChange = await writeSandboxChanges(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, {
            'gspot.toml': buildSandboxSettings(['python'], { level: 'basic' }),
            'sample.py': source,
        }),
    );
    const fixed = parseCheckReport(
        await spawnGspot(root, ['check', 'sample.py', '--only', 'python/ruff', '--fix', '--json']),
    );
    expect(await readFile(join(root, 'sample.py'), 'utf8')).toBe(source);
    expect(fixed.report.checks.flatMap(({ findings }) => findings.map(({ rule }) => rule))).toStrictEqual(['F401']);
});
