import { z } from 'zod';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { openOwnershipLog } from '#cli/ownership/log.ts';
import { containingAll } from '#tests/setup/matchers.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { runCommandBlocking } from '#tests/setup/processes.ts';
import { toolsPath, installToolProjects } from '#tests/setup/install.ts';
import { virtualEnvironmentExecutable } from '#cli/system/executables.ts';

import {
    VERSION_SOURCE,
    FUNCTION_SOURCE,
    RUFF_RULE_SOURCE,
    RUFF_FORMAT_CASES,
    RUFF_VERSION_CASES,
    RUFF_RULE_ARGUMENTS,
    RUFF_FORMAT_ARGUMENTS,
    DUPLICATE_IMPORT_SOURCE,
} from '#tests/config/ruff.ts';

test('Ruff selects the pytest lint rules and scope limits only in the scope that selects pytest', async () => {
    await using sandbox = await testdir();
    const sample = `"""Sample declarations."""

import pytest


@pytest.fixture()
def example() -> int:
    """Provide a reusable value."""
    return 1
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['python'], {
            level: 'all',
            tables: `[[scope]]
path = "app"

configurations = ["pytest"]
[scope.limits.python]
function_parameters = 3
[[ignore]]
check = "python/ruff"
rule = "S101"
paths = ["app/tests/**"]
reason = "Test assertions deliberately verify the behavior."
`,
        }),
        'tests/__init__.py': '"""Root test package."""\n',
        'app/__init__.py': '"""Application package."""\n',
        'app/tests/__init__.py': '"""Application test package."""\n',
        'tests/test_example.py': sample,
        'app/tests/test_example.py': sample,
    });
    await installToolProjects(sandbox.path);
    const session = await openSession(sandbox.path);
    const emitted = emitAll(session);
    const configs = emitted.files.filter(({ path }) => path.startsWith('.gspot/') && path.endsWith('/ruff.toml'));
    expect(configs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/config/app/ruff.toml',
        '.gspot/config/ruff.toml',
    ]);
    using log = openOwnershipLog(sandbox.path);
    writeGeneratedFiles(session, emitted, log);
    const app = parse(configs.find(({ path }) => path === '.gspot/config/app/ruff.toml')!.content);
    expect(app).toMatchObject({ lint: { select: containingAll(['PT001']) } });

    await verifyPytestSelection(sandbox.path, sample);
    await verifyAssertionIgnore(sandbox.path);
});

test.each([...LEVELS])('Ruff at level %s reports correctness, and print calls only at level all', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['python'], { level }),
        'sample.py': RUFF_RULE_SOURCE,
    });
    await installToolProjects(sandbox.path);
    const resultRules = runCommandBlocking(
        [virtualEnvironmentExecutable(join(sandbox.path, '.gspot/.venv'), 'ruff'), ...RUFF_RULE_ARGUMENTS],
        { cwd: sandbox.path },
    );
    expect(resultRules.code, resultRules.stdout + resultRules.stderr).toBe(0);
    const rules = z
        .array(z.object({ code: z.string().nullable(), preview: z.boolean() }))
        .parse(JSON.parse(resultRules.stdout));
    const previewCodes = new Set(rules.flatMap(({ code, preview }) => (code !== null && preview ? [code] : [])));
    const command = ['check', 'sample.py', '--only', 'python/ruff', '--json'];
    const config = z
        .object({ lint: z.object({ select: z.array(z.string()) }) })
        .parse(parse(await Bun.file(join(sandbox.path, '.gspot/config/ruff.toml')).text()));
    expect(config.lint.select.filter((code) => previewCodes.has(code))).toStrictEqual([]);
    const options = { cwd: sandbox.path, env: { PATH: toolsPath() } };
    const result = await spawnGspot(sandbox.path, command, options.env);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const findings = (JSON.parse(result.stdout) as RunReport).checks.flatMap((check) => check.findings);
    expect(
        findings
            .filter(({ rule }) => rule !== undefined && ['F821', 'T201'].includes(rule))
            .map(({ rule, line }) => [rule, line]),
    ).toStrictEqual(
        level === 'all'
            ? [
                  ['F821', 1],
                  ['T201', 2],
              ]
            : [['F821', 1]],
    );
    await Bun.write(
        join(sandbox.path, 'sample.py'),
        `"""An arithmetic example."""

answer = 42
`,
    );
    const corrected = await spawnGspot(sandbox.path, command, options.env);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('python/function-size is the only function size limit, and Ruff reports no statement count', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['python'], { level: 'all' }),
        'sample.py': FUNCTION_SOURCE,
    });
    await installToolProjects(sandbox.path);
    const checked = await spawnGspot(sandbox.path, ['check', 'sample.py', '--only', 'python/ruff', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect((JSON.parse(checked.stdout) as RunReport).checks.flatMap((check) => check.findings)).toStrictEqual([]);
    const sized = await spawnGspot(sandbox.path, ['check', '--only', 'python/function-size', '--json']);
    expect(sized.code, sized.stdout + sized.stderr).toBe(0);
    expect((JSON.parse(sized.stdout) as RunReport).checks).toMatchObject([
        { check: 'python/function-size', status: 'passed', findings: [] },
    ]);
});

test('Ruff run by an editor and through gspot formats each scope the same way', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['python'], {
            tables: `[format]
quotes = "single"
line_ending = "crlf"
[[scope]]
path = "app"

[scope.format]
quotes = "double"
line_ending = "lf"
`,
        }),
        'sample.py': 'VALUE = "example"\n',
        'app/sample.py': 'VALUE = "example"\n',
    });
    await installToolProjects(sandbox.path);
    for (const { file, formatted } of RUFF_FORMAT_CASES) {
        const options = { cwd: sandbox.path, env: { PATH: toolsPath() } };
        const fixed = await spawnGspot(
            sandbox.path,
            ['check', file, '--only', 'python/ruff-format', '--fix', '--json'],
            options.env,
        );
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, file)).text()).toBe(formatted);
        const editor = runCommandBlocking(
            [virtualEnvironmentExecutable(join(sandbox.path, '.gspot/.venv'), 'ruff'), ...RUFF_FORMAT_ARGUMENTS, file],
            options,
        );
        expect(editor.code, editor.stdout + editor.stderr).toBe(0);
    }
});

test("Ruff fixes follow each scope's minimum Python version", async () => {
    await using sandbox = await testdir();
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
    await createFileTree(sandbox.path, { 'gspot.toml': settingsText(['python'], { level: 'all', tables }), ...files });
    const applied = await spawnGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installToolProjects(sandbox.path);
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

test('Ruff alone reports an unused import, and basedpyright still reports the type error', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['python'], { level: 'all' }),
        'sample.py': DUPLICATE_IMPORT_SOURCE,
    });
    const applied = await spawnGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installToolProjects(sandbox.path);
    const command = ['check', '--only', 'python/ruff', 'python/basedpyright', '--json'];
    const checked = await spawnGspot(sandbox.path, command);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = JSON.parse(checked.stdout) as RunReport;
    expect(
        report.checks.flatMap(({ findings }) =>
            findings.map(({ check, file, line, rule }) => ({ check, file, line, rule })),
        ),
    ).toStrictEqual([
        { check: 'python/ruff', file: 'sample.py', line: 3, rule: 'F401' },
        { check: 'python/basedpyright', file: 'sample.py', line: 5, rule: 'reportAssignmentType' },
    ]);
    await Bun.write(
        join(sandbox.path, 'sample.py'),
        `"""An example module."""

TOTAL: int = 1
`,
    );
    const corrected = await spawnGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

/** Check that pytest fixture rules affect only the scope selecting pytest. */
async function verifyPytestSelection(root: string, sample: string): Promise<void> {
    const unselected = await spawnGspot(root, ['check', 'tests/test_example.py', '--only', 'python/ruff', '--json']);
    expect(unselected.code, unselected.stdout + unselected.stderr).toBe(0);
    const failed = await spawnGspot(root, ['check', 'app/tests/test_example.py', '--only', 'python/ruff', '--json']);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap((check) => check.findings)).toMatchObject([
        { rule: 'PT001' },
    ]);
    await Bun.write(join(root, 'app/tests/test_example.py'), sample.replace('@pytest.fixture()', '@pytest.fixture'));
    const corrected = await spawnGspot(root, ['check', 'app/tests/test_example.py', '--only', 'python/ruff', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
}

/** Check that the authored assertion ignore affects only the scoped test paths. */
async function verifyAssertionIgnore(root: string): Promise<void> {
    for (const path of ['tests/test_example.py', 'app/tests/test_example.py'])
        await Bun.write(
            join(root, path),
            `"""An assertion example."""

assert True
`,
        );
    const rootAssertion = await spawnGspot(root, ['check', 'tests/test_example.py', '--only', 'python/ruff', '--json']);
    expect(rootAssertion.code, rootAssertion.stderr).toBe(1);
    expect((JSON.parse(rootAssertion.stdout) as RunReport).checks.flatMap((check) => check.findings)).toMatchObject([
        { rule: 'S101' },
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
