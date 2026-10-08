import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/apply.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { containingAll } from '#tests/harness/expectations.ts';
import { installToolProjects } from '#tests/harness/install.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import type { RuffFinding } from '#tests/types/tools/generation/ruff.ts';

import {
    RULE_SOURCE,
    FORMAT_CASES,
    VERSION_CASES,
    VERSION_SOURCE,
    FUNCTION_SOURCE,
    DUPLICATE_SOURCE,
} from '#tests/config/tools/generation/ruff.ts';

test('Ruff keeps pytest rules and scoped limits inside their selected project', async () => {
    await using sandbox = await testdir();
    const defect =
        '"""Fixture declarations."""\n\nimport pytest\n\n\n@pytest.fixture()\ndef example() -> int:\n    """Provide a reusable value."""\n    return 1\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python'], {
            level: 'all',
            tables: '[scope."app"]\nconfigurations = ["pytest"]\n[scope."app".limits.python]\nfunction_parameters = 3\n',
        }),
        'tests/__init__.py': '"""Root test package."""\n',
        'app/__init__.py': '"""Application package."""\n',
        'app/tests/__init__.py': '"""Application test package."""\n',
        'tests/test_example.py': defect,
        'app/tests/test_example.py': defect,
    });
    const session = await openSession(sandbox.path);
    const emitted = emitAll(session);
    const configs = emitted.files.filter(({ path }) => path.startsWith('.gspot/') && path.endsWith('/ruff.toml'));
    expect(configs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/config/app/ruff.toml',
        '.gspot/config/ruff.toml',
    ]);
    using log = openOwnership(sandbox.path);
    writeGeneratedFiles(session, log, undefined, emitted);
    const app = parse(configs.find(({ path }) => path === '.gspot/config/app/ruff.toml')!.content);
    expect(app).toMatchObject({ lint: { select: containingAll(['PT001']) } });

    const run = (path: string) =>
        runTestCommandBlocking(['ruff', 'check', '--no-cache', '--output-format', 'json', path], {
            cwd: sandbox.path,
        });
    const unselected = run('tests/test_example.py');
    expect(unselected.code, unselected.stdout + unselected.stderr).toBe(0);
    const failed = run('app/tests/test_example.py');
    expect(failed.code, failed.stderr).toBe(1);
    expect(JSON.parse(failed.stdout)).toMatchObject([{ code: 'PT001' }]);
    await Bun.write(
        join(sandbox.path, 'app/tests/test_example.py'),
        defect.replace('@pytest.fixture()', '@pytest.fixture'),
    );
    const corrected = run('app/tests/test_example.py');
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    for (const path of ['tests/test_example.py', 'app/tests/test_example.py'])
        await Bun.write(join(sandbox.path, path), '"""An assertion example."""\n\nassert True\n');
    const rootAssertion = run('tests/test_example.py');
    expect(rootAssertion.code, rootAssertion.stderr).toBe(1);
    expect(JSON.parse(rootAssertion.stdout)).toMatchObject([{ code: 'S101' }]);
    const testAssertion = run('app/tests/test_example.py');
    expect(testAssertion.code, testAssertion.stderr).toBe(0);
});

test.each(['recommended', 'all'] as const)(
    'Ruff keeps correctness at %s and runs print conventions only at all',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['python'], { level }),
            'sample.py': RULE_SOURCE,
        });
        const session = await openSession(sandbox.path);
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, log);
        const result = runTestCommandBlocking(
            [
                'ruff',
                'check',
                '--config',
                '.gspot/config/ruff.toml',
                '--no-cache',
                '--output-format',
                'json',
                'sample.py',
            ],
            { cwd: sandbox.path },
        );
        expect(result.code, result.stdout + result.stderr).toBe(1);
        const findings = JSON.parse(result.stdout) as RuffFinding[];
        expect(
            findings
                .filter(({ code }) => ['F821', 'T201'].includes(code))
                .map(({ code, location }) => [code, location.row]),
        ).toStrictEqual(
            level === 'all'
                ? [
                      ['F821', 1],
                      ['T201', 2],
                  ]
                : [['F821', 1]],
        );
        await Bun.write(join(sandbox.path, 'sample.py'), '"""An arithmetic example."""\n\nanswer = 42\n');
        const corrected = runTestCommandBlocking(
            [
                'ruff',
                'check',
                '--config',
                '.gspot/config/ruff.toml',
                '--no-cache',
                '--output-format',
                'json',
                'sample.py',
            ],
            { cwd: sandbox.path },
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(JSON.parse(corrected.stdout)).toStrictEqual([]);
    },
);

test('Python uses one function-size ceiling without a second statement-count finding', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        'sample.py': FUNCTION_SOURCE,
    });
    const session = await openSession(sandbox.path);
    using log = openOwnership(sandbox.path);
    writeGeneratedFiles(session, log);
    const checked = runTestCommandBlocking(
        ['ruff', 'check', '--config', '.gspot/config/ruff.toml', '--no-cache', '--output-format', 'json', 'sample.py'],
        { cwd: sandbox.path },
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(JSON.parse(checked.stdout)).toStrictEqual([]);
    const sized = await spawnGspot(sandbox.path, ['check', '--only', 'python/function-size', '--json']);
    expect(sized.code, sized.stdout + sized.stderr).toBe(0);
    expect((JSON.parse(sized.stdout) as RunReport).checks).toMatchObject([
        { check: 'python/function-size', status: 'passed', findings: [] },
    ]);
});

test('Ruff editor discovery and explicit formatting agree on root and nested policy', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], {
            tables: '[format]\nquotes = "single"\nline_ending = "crlf"\n[scope."app"]\n[scope."app".format]\nquotes = "double"\nline_ending = "lf"\n',
        }),
        'sample.py': 'VALUE = "example"\n',
        'app/sample.py': 'VALUE = "example"\n',
    });
    const session = await openSession(sandbox.path);
    using log = openOwnership(sandbox.path);
    writeGeneratedFiles(session, log);
    for (const { file, config, formatted } of FORMAT_CASES) {
        const fixed = runTestCommandBlocking(['ruff', 'format', '--config', config, '--no-cache', file], {
            cwd: sandbox.path,
        });
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, file)).text()).toBe(formatted);
        const editor = runTestCommandBlocking(['ruff', 'format', '--check', '--no-cache', file], {
            cwd: sandbox.path,
        });
        expect(editor.code, editor.stdout + editor.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, file)).text()).toBe(formatted);
    }
});

test.each(['recommended', 'all'] as const)('Ruff fixes respect each project Python version at %s', async (level) => {
    await using sandbox = await testdir();
    const tables = VERSION_CASES.filter(({ scope }) => scope !== '')
        .map(({ scope }) => `[scope."${scope}"]\n`)
        .join('');
    const files = Object.fromEntries(
        VERSION_CASES.flatMap(({ scope, requires }) => [
            [
                join(scope, 'pyproject.toml'),
                `[project]\nname = "version-example"\nversion = "1.0.0"\nrequires-python = "${requires}"\n`,
            ],
            [join(scope, 'sample.py'), VERSION_SOURCE],
        ]),
    );
    await createFileTree(sandbox.path, { 'gspot.toml': buildPolicy(['python'], { level, tables }), ...files });
    const applied = await spawnGspot(sandbox.path, ['apply', '--json']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    await installToolProjects(sandbox.path);
    const command = ['check', '--only', 'python/ruff', '--json'];
    const checked = await spawnGspot(sandbox.path, command);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = JSON.parse(checked.stdout) as RunReport;
    for (const { scope, generics, unions } of VERSION_CASES) {
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
    for (const { scope, annotation } of VERSION_CASES) {
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

test.each(['recommended', 'all'] as const)(
    'Python diagnostics keep one unused-import owner and retain type errors at %s',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['python'], { level }),
            'sample.py': DUPLICATE_SOURCE,
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
        await Bun.write(join(sandbox.path, 'sample.py'), '"""An example module."""\n\nTOTAL: int = 1\n');
        const corrected = await spawnGspot(sandbox.path, command);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toStrictEqual(
            [],
        );
    },
);
