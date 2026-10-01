import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { containingAll } from '#tests/support/expectations.ts';

test('Ruff keeps pytest rules and scoped limits inside their selected project', async () => {
    await using sandbox = await testdir();
    const defect = 'import pytest\n\n@pytest.fixture()\ndef example():\n    return 1\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(
            ['python'],
            '[tools.ruff]\nselect = ["S101"]\n[[scope]]\npath = "app"\nkits = ["pytest"]\n[scope.tools.ruff]\nselect = ["PT001"]\n[scope.limits.python]\nfunction_parameters = 3\n',
        ),
        'tests/test_example.py': defect,
        'app/tests/test_example.py': defect,
    });
    const session = await openSession(sandbox.path);
    const configs = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.filter(({ path }) => path.endsWith('/ruff.toml'));
    expect(configs.map(({ path }) => path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
        '.gspot/config/app/ruff.toml',
        '.gspot/config/ruff.toml',
    ]);
    for (const config of configs) await Bun.write(join(sandbox.path, config.path), config.content);
    const root = parse(configs.find(({ path }) => path === '.gspot/config/ruff.toml')!.content);
    const app = parse(configs.find(({ path }) => path === '.gspot/config/app/ruff.toml')!.content);
    expect(root).toMatchObject({ lint: { pylint: { 'max-args': 7 } } });
    expect(app).toMatchObject({ lint: { pylint: { 'max-args': 3 }, select: containingAll(['PT001']) } });
    // eslint-disable-next-line gspot/no-trivial-functions -- reason: The runs call Ruff with the same flags on a different configuration and file.
    const run = (config: string, path: string) =>
        Bun.spawnSync(['ruff', 'check', '--config', config, '--no-cache', '--output-format', 'json', path], {
            cwd: sandbox.path,
            stdout: 'pipe',
            stderr: 'pipe',
        });
    const unselected = run('.gspot/config/ruff.toml', 'tests/test_example.py');
    expect(unselected.exitCode, unselected.stdout.toString() + unselected.stderr.toString()).toBe(0);
    const failed = run('.gspot/config/app/ruff.toml', 'app/tests/test_example.py');
    expect(failed.exitCode, failed.stderr.toString()).toBe(1);
    expect(JSON.parse(failed.stdout.toString())).toMatchObject([{ code: 'PT001' }]);
    await Bun.write(
        join(sandbox.path, 'app/tests/test_example.py'),
        defect.replace('@pytest.fixture()', '@pytest.fixture'),
    );
    const corrected = run('.gspot/config/app/ruff.toml', 'app/tests/test_example.py');
    expect(corrected.exitCode, corrected.stdout.toString() + corrected.stderr.toString()).toBe(0);
    for (const path of ['tests/test_example.py', 'app/tests/test_example.py'])
        await Bun.write(join(sandbox.path, path), 'assert True\n');
    const rootAssertion = run('.gspot/config/ruff.toml', 'tests/test_example.py');
    expect(rootAssertion.exitCode, rootAssertion.stderr.toString()).toBe(1);
    expect(JSON.parse(rootAssertion.stdout.toString())).toMatchObject([{ code: 'S101' }]);
    const testAssertion = run('.gspot/config/app/ruff.toml', 'app/tests/test_example.py');
    expect(testAssertion.exitCode, testAssertion.stderr.toString()).toBe(0);
});
