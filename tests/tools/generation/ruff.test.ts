import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { openSession } from '#cli/execution/session.ts';
import { containingAll } from '#tests/harness/expectations.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { runTestCommandBlocking } from '#tests/harness/command.ts';

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
    const configs = rendered.files.filter(({ path }) => path.endsWith('/ruff.toml'));
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
