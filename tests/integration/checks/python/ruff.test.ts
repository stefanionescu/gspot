import { z } from 'zod';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { matchItems } from '#tests/setup/matchers.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildSandboxChanges } from '#tests/setup/builders.ts';
import { runCommandBlocking } from '#tests/setup/processes.ts';
import type { RunReport } from '#cli/types/checks/run/check.ts';
import { runSandboxStep, buildSandboxPath } from '#tests/setup/install.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { convertToPosixPath, buildVenvExecutablePath } from '#cli/system/paths.ts';

import {
    RUFF_SANDBOX,
    FUNCTION_SOURCE,
    RUFF_RULE_SOURCE,
    RUFF_FORMAT_CASES,
    RUFF_RULE_ARGUMENTS,
    RUFF_FORMAT_ARGUMENTS,
    DUPLICATE_IMPORT_SOURCE,
} from '#tests/data/checks/python/tool-checks.ts';

const installedSandbox = registerSharedSandbox(RUFF_SANDBOX);

test('Ruff selects the pytest lint rules and scope limits only in the scope that selects pytest', async () => {
    const sandbox = { path: installedSandbox().root };
    const sample = `"""Sample declarations."""

import pytest


@pytest.fixture()
def example() -> int:
    """Provide a reusable value."""
    return 1
`;
    const sourceFiles = {
        'gspot.toml': buildSettingsText(['python'], {
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
    };
    await using _sourceChange = await updateSandbox(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
    );
    await runSandboxStep(sandbox.path, ['apply'], {}, 'apply');
    const configs = await Promise.all(
        [...new Bun.Glob('.gspot/config/**/ruff.toml').scanSync({ cwd: sandbox.path, dot: true })].map(
            async (path) => ({
                path: convertToPosixPath(path),
                content: await Bun.file(join(sandbox.path, path)).text(),
            }),
        ),
    );
    expect(configs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/config/ruff.toml',
        '.gspot/config/ruff/app/ruff.toml',
    ]);
    const app: unknown = parse(configs.find(({ path }) => path === '.gspot/config/ruff/app/ruff.toml')!.content);
    expect(app).toMatchObject({ lint: { select: matchItems(['PT001']) } });

    await verifyPytestSelection(sandbox.path, sample);
    await verifyAssertionIgnore(sandbox.path);
});

test.each([...LEVELS])('Ruff at level %s reports correctness, and print calls only at level all', async (level) => {
    const sandbox = { path: installedSandbox().root };
    const sourceFiles = {
        'gspot.toml': buildSettingsText(['python'], { level }),
        'sample.py': RUFF_RULE_SOURCE,
    };
    await using _sourceChange = await updateSandbox(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
    );
    await runSandboxStep(sandbox.path, ['apply'], {}, 'apply');
    const resultRules = runCommandBlocking(
        [buildVenvExecutablePath(join(sandbox.path, '.gspot/.venv'), 'ruff'), ...RUFF_RULE_ARGUMENTS],
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
    const options = { cwd: sandbox.path, env: { PATH: buildSandboxPath() } };
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

test('Ruff reports the configured statement limit at level all', async () => {
    const sandbox = { path: installedSandbox().root };
    const sourceFiles = {
        'gspot.toml': buildSettingsText(['python'], { level: 'all' }),
        'sample.py': FUNCTION_SOURCE,
    };
    await using _sourceChange = await updateSandbox(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
    );
    await runSandboxStep(sandbox.path, ['apply'], {}, 'apply');
    const checked = await spawnGspot(sandbox.path, ['check', 'sample.py', '--only', 'python/ruff', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    expect((JSON.parse(checked.stdout) as RunReport).checks.flatMap((check) => check.findings)).toMatchObject([
        { check: 'python/ruff', file: 'sample.py', rule: 'PLR0915' },
    ]);
});

test('Ruff run by an editor and through gspot formats each scope the same way', async () => {
    const sandbox = { path: installedSandbox().root };
    const sourceFiles = {
        'gspot.toml': buildSettingsText(['python'], {
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
    };
    await using _sourceChange = await updateSandbox(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
    );
    await runSandboxStep(sandbox.path, ['apply'], {}, 'apply');
    for (const { file, formatted } of RUFF_FORMAT_CASES) {
        const options = { cwd: sandbox.path, env: { PATH: buildSandboxPath() } };
        const fixed = await spawnGspot(
            sandbox.path,
            ['check', file, '--only', 'python/ruff-format', '--fix', '--json'],
            options.env,
        );
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, file)).text()).toBe(formatted);
        const editor = runCommandBlocking(
            [buildVenvExecutablePath(join(sandbox.path, '.gspot/.venv'), 'ruff'), ...RUFF_FORMAT_ARGUMENTS, file],
            options,
        );
        expect(editor.code, editor.stdout + editor.stderr).toBe(0);
    }
});

test('Ruff alone reports an unused import, and basedpyright still reports the type error', async () => {
    const sandbox = { path: installedSandbox().root };
    const sourceFiles = {
        'gspot.toml': buildSettingsText(['python'], { level: 'all' }),
        'sample.py': DUPLICATE_IMPORT_SOURCE,
    };
    await using _sourceChange = await updateSandbox(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
    );
    await runSandboxStep(sandbox.path, ['apply'], {}, 'apply');
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
