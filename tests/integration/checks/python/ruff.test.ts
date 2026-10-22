import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { matchItems } from '#tests/setup/matchers.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { buildVenvExecutablePath } from '#cli/system/paths.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readGeneratedFiles } from '#tests/setup/cli/config-files.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { RUFF_SANDBOX } from '#tests/data/integration/checks/python/sandbox.ts';
import { ruffRulesSchema, ruffConfigurationSchema } from '#tests/schemas/checks/ruff.ts';
import { applySandboxChanges, buildSandboxChanges } from '#tests/setup/sandboxes/changes.ts';

import {
    PYTEST_SAMPLE,
    RUFF_RULE_SOURCE,
    RUFF_FORMAT_CASES,
    RUFF_RULE_ARGUMENTS,
    UNUSED_IMPORT_SOURCE,
    RUFF_FORMAT_ARGUMENTS,
} from '#tests/data/integration/checks/python/ruff.ts';

/** Check that pytest fixture rules apply only in the scope that uses pytest. */
async function assertPytestSelection(root: string, sample: string): Promise<void> {
    const unselected = await spawnGspot(root, ['check', 'tests/test_example.py', '--only', 'python/ruff', '--json']);
    expect(unselected.code, unselected.stdout + unselected.stderr).toBe(0);
    const failed = parseCheckReport(
        await spawnGspot(root, ['check', 'app/tests/test_example.py', '--only', 'python/ruff', '--json']),
    );
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks.flatMap((check) => check.findings)).toMatchObject([{ rule: 'PT001' }]);
    await writeFile(join(root, 'app/tests/test_example.py'), sample.replace('@pytest.fixture()', '@pytest.fixture'));
    const corrected = await spawnGspot(root, ['check', 'app/tests/test_example.py', '--only', 'python/ruff', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
}

/** Check that the authored assertion ignore affects only the scoped test paths. */
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
    expect(rootAssertion.report.checks.flatMap((check) => check.findings)).toMatchObject([{ rule: 'S101' }]);
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
    const sample = PYTEST_SAMPLE;
    const sourceFiles = {
        'gspot.toml': buildSandboxSettings(['python'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['pytest'] }],
            tables: '[[ignore]]\ncheck = "python/ruff"\nrule = "S101"\npaths = ["app/tests/**"]\nreason = "Test assertions deliberately verify the behavior."\n',
        }),
        'tests/__init__.py': '"""Root test package."""\n',
        'app/__init__.py': '"""Application package."""\n',
        'app/tests/__init__.py': '"""Application test package."""\n',
        'tests/test_example.py': sample,
        'app/tests/test_example.py': sample,
    };
    await using _sourceChange = await applySandboxChanges(
        installedSandbox(),
        buildSandboxChanges(RUFF_SANDBOX.files, sourceFiles),
    );

    const configs = await readGeneratedFiles(root, '.gspot/configurations/**/ruff.toml');
    expect(configs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/configurations/language/python/ruff.toml',
        '.gspot/configurations/language/python/scopes/app/ruff.toml',
    ]);
    const app: unknown = parse(
        configs.find(({ path }) => path === '.gspot/configurations/language/python/scopes/app/ruff.toml')!.content,
    );
    expect(app).toMatchObject({ lint: { select: matchItems(['PT001']) } });

    await assertPytestSelection(root, sample);
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
            [buildVenvExecutablePath(join(root, '.gspot/.venv'), 'ruff'), ...RUFF_RULE_ARGUMENTS],
            { cwd: root },
        );
        expect(resultRules.code, resultRules.stdout + resultRules.stderr).toBe(0);
        const rules = ruffRulesSchema.parse(JSON.parse(resultRules.stdout));
        const previewCodes = new Set(rules.flatMap(({ code, preview }) => (code !== null && preview ? [code] : [])));
        const command = ['check', 'sample.py', '--only', 'python/ruff', '--json'];
        const config = ruffConfigurationSchema.parse(
            parse(await readFile(join(root, '.gspot/configurations/language/python/ruff.toml'), 'utf8')),
        );
        expect(config.lint.select.filter((code) => previewCodes.has(code))).toStrictEqual([]);
        const result = parseCheckReport(await spawnGspot(root, command, {}));
        expect(result.code, result.stdout + result.stderr).toBe(1);
        const findings = result.report.checks.flatMap((check) => check.findings);
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
        await writeFile(
            join(root, 'sample.py'),
            `"""An arithmetic example."""

answer = 42
`,
        );
        const corrected = await spawnGspot(root, command, {});
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
        const fixed = await spawnGspot(root, ['check', file, '--only', 'python/ruff-format', '--fix', '--json'], {});
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await readFile(join(root, file), 'utf8')).toBe(formatted);
        const editor = runCommandBlocking(
            [buildVenvExecutablePath(join(root, '.gspot/.venv'), 'ruff'), ...RUFF_FORMAT_ARGUMENTS, file],
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
    const report = checked.report;
    expect(
        report.checks.flatMap(({ findings }) =>
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
