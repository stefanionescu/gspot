// Policy errors name their gspot.toml location and accept the suggested correction.
import { run } from '#tests/support/cli/command.ts';
import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

test.each([
    { scope: 'root', policy: 'version = 1\nconfigurations = ["bas"]\n', line: 2 },
    {
        scope: 'nested',
        policy: 'version = 1\nconfigurations = []\n[[scope]]\npath = "api"\nconfigurations = ["bas"]\n',
        line: 5,
    },
])(
    'unknown configurations in the $scope scope identify their declaration and accept the suggested configuration',
    async ({ policy, line }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/example.toml': 'value = 1\n' });
        const invalid = await run(sandbox.path, ['list', '--json']);
        expect(invalid.code).toBe(2);
        const diagnostic = JSON.parse(invalid.stdout);
        expect(diagnostic.message).toContain(`gspot.toml:${String(line)}:`);
        expect(diagnostic.message).toContain('bash');
        writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace('"bas"', '"bash"'));
        const corrected = await run(sandbox.path, ['list', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

test.each([
    {
        name: 'a root loosening',
        policy: 'version = 1\nconfigurations = ["bash"]\nrequire_reasons = true\n[limits]\nfile_lines = 1000\n',
        line: 5,
        before: '1000',
        after: '200',
    },
    {
        name: 'a nested unknown setting',
        policy: 'version = 1\nconfigurations = ["bash"]\n[[scope]]\npath = "api"\n[scope.limits]\nfile_linse = 200\n',
        line: 6,
        before: 'file_linse',
        after: 'file_lines',
    },
])('effective-setting errors locate $name and accept a correction', async ({ policy, line, before, after }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/source.sh': 'echo example\n' });
    const invalid = await run(sandbox.path, ['list', '--json']);
    expect(invalid.code).toBe(2);
    expect(JSON.parse(invalid.stdout).message).toContain(`gspot.toml:${String(line)}:`);
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace(before, after));
    const corrected = await run(sandbox.path, ['list', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each(['\n', '\r\n'])(
    'configuration errors retain source locations in text and JSON with %j lines',
    async (newline) => {
        await using sandbox = await testdir();
        const policy = ['version = 1', 'configurations = []', 'require_reasons = "wrong"', ''].join(newline);
        await createFileTree(sandbox.path, { 'gspot.toml': policy });
        const text = await run(sandbox.path, ['check']);
        expect(text.code).toBe(2);
        expect(text.stdout + text.stderr).toContain('gspot.toml:3:19: require_reasons:');
        const json = await run(sandbox.path, ['check', '--json']);
        expect(json.code).toBe(2);
        expect(JSON.parse(json.stdout)).toMatchObject({
            error: 'PolicyError',
            message: expect.stringContaining('gspot.toml:3:19:'),
        });
        writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace('"wrong"', 'true'));
        const corrected = await run(sandbox.path, ['check', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
