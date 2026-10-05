import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { openSession } from '#cli/execution/session.ts';
import { containingAll } from '#tests/harness/expectations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';
import type { RuffFinding } from '#tests/types/tools/generation/ruff.ts';
import { RULE_SOURCE, FORMAT_CASES, FUNCTION_SOURCE } from '#tests/config/tools/generation/ruff.ts';

test('Ruff keeps pytest rules and scoped limits inside their selected project', async () => {
    await using sandbox = await testdir();
    const defect = 'import pytest\n\n@pytest.fixture()\ndef example():\n    return 1\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python'], {
            tables: '[tools.ruff]\nselect = ["S101"]\n[[scope]]\npath = "app"\nconfigurations = ["pytest"]\n[scope.tools.ruff]\nselect = ["PT001"]\n[scope.limits.python]\nfunction_parameters = 3\n',
        }),
        'tests/test_example.py': defect,
        'app/tests/test_example.py': defect,
    });
    const session = await openSession(sandbox.path);
    const rendered = emitAll(session);
    const configs = rendered.files.filter(({ path }) => path.startsWith('.gspot/') && path.endsWith('/ruff.toml'));
    expect(configs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/config/app/ruff.toml',
        '.gspot/config/ruff.toml',
    ]);
    using log = openOwnership(sandbox.path);
    writeOutputs(session, log, undefined, rendered);
    const root = parse(configs.find(({ path }) => path === '.gspot/config/ruff.toml')!.content);
    const app = parse(configs.find(({ path }) => path === '.gspot/config/app/ruff.toml')!.content);
    expect(root).toMatchObject({ lint: { pylint: { 'max-args': 7 } } });
    expect(app).toMatchObject({ lint: { pylint: { 'max-args': 3 }, select: containingAll(['PT001']) } });

    const run = (config: string, path: string) =>
        runTestCommandBlocking(['ruff', 'check', '--config', config, '--no-cache', '--output-format', 'json', path], {
            cwd: sandbox.path,
        });
    const unselected = run('.gspot/config/ruff.toml', 'tests/test_example.py');
    expect(unselected.code, unselected.stdout + unselected.stderr).toBe(0);
    const failed = run('.gspot/config/app/ruff.toml', 'app/tests/test_example.py');
    expect(failed.code, failed.stderr).toBe(1);
    expect(JSON.parse(failed.stdout)).toMatchObject([{ code: 'PT001' }]);
    await Bun.write(
        join(sandbox.path, 'app/tests/test_example.py'),
        defect.replace('@pytest.fixture()', '@pytest.fixture'),
    );
    const corrected = run('.gspot/config/app/ruff.toml', 'app/tests/test_example.py');
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    for (const path of ['tests/test_example.py', 'app/tests/test_example.py'])
        await Bun.write(join(sandbox.path, path), 'assert True\n');
    const rootAssertion = run('.gspot/config/ruff.toml', 'tests/test_example.py');
    expect(rootAssertion.code, rootAssertion.stderr).toBe(1);
    expect(JSON.parse(rootAssertion.stdout)).toMatchObject([{ code: 'S101' }]);
    const testAssertion = run('.gspot/config/app/ruff.toml', 'app/tests/test_example.py');
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
        writeOutputs(session, log);
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
    writeOutputs(session, log);
    const checked = runTestCommandBlocking(
        ['ruff', 'check', '--config', '.gspot/config/ruff.toml', '--no-cache', '--output-format', 'json', 'sample.py'],
        { cwd: sandbox.path },
    );
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(JSON.parse(checked.stdout)).toStrictEqual([]);
    const sized = await spawnGspot(sandbox.path, ['check', '--only', 'python/function-lines', '--json']);
    expect(sized.code, sized.stdout + sized.stderr).toBe(0);
    expect((JSON.parse(sized.stdout) as RunReport).checks).toMatchObject([
        { check: 'python/function-lines', status: 'passed', findings: [] },
    ]);
});

test('Ruff editor discovery and explicit formatting agree on root and nested policy', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python'], {
            tables: '[format]\nquotes = "single"\nline_ending = "crlf"\n[[scope]]\npath = "app"\n[scope.format]\nquotes = "double"\nline_ending = "lf"\n',
        }),
        'sample.py': 'VALUE = "example"\n',
        'app/sample.py': 'VALUE = "example"\n',
    });
    const session = await openSession(sandbox.path);
    using log = openOwnership(sandbox.path);
    writeOutputs(session, log);
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
