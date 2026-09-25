import { expect, test } from 'bun:test';
import { join } from 'node:path';

import { emitAll } from '#cli/generation/render.ts';
import { parse } from 'smol-toml';

import { openSession } from '#cli/execution/session.ts';
import { createFileTree, testdir } from 'testdirs';

test('Ruff keeps pytest rules and scoped limits inside their selected project', async () => {
    await using sandbox = await testdir();
    const defect = 'import pytest\n\n@pytest.fixture()\ndef example():\n    return 1\n';
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'version = 1\nconfigurations = ["python"]\n[[scope]]\npath = "app"\nconfigurations = ["pytest"]\n[scope.limits.python]\nfunction_parameters = 3\n',
        'tests/test_example.py': defect,
        'app/tests/test_example.py': defect,
    });
    const renderSession3 = await openSession(sandbox.path);
    const configs = emitAll(renderSession3.policyFiles.policy, renderSession3.repository, renderSession3.scopes, {
        version: renderSession3.version,
        packageManager: renderSession3.packageManager,
    }).files.filter(({ path }) => path.endsWith('/ruff.toml'));
    expect(configs.map(({ path }) => path).sort()).toStrictEqual([
        '.gspot/config/app/ruff.toml',
        '.gspot/config/ruff.toml',
    ]);
    for (const config of configs) await Bun.write(join(sandbox.path, config.path), config.content);
    const root = parse(configs.find(({ path }) => path === '.gspot/config/ruff.toml')!.content);
    const app = parse(configs.find(({ path }) => path === '.gspot/config/app/ruff.toml')!.content);
    expect(root).toMatchObject({ lint: { pylint: { 'max-args': 7 } } });
    expect(app).toMatchObject({ lint: { pylint: { 'max-args': 3 }, select: expect.arrayContaining(['PT']) } });
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
