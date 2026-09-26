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

test('a nested unknown setting is a finding at its line, and its correction clears it', async () => {
    const policy =
        'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n[[scope]]\npath = "api"\n[scope.limits]\nfile_linse = 200\n';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/source.sh': 'echo example\n' });
    const invalid = await run(sandbox.path, ['check', '--only', 'bash/syntax', '--no-cache', '--json']);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    const report = JSON.parse(invalid.stdout) as { checks: { check: string; findings: { line?: number }[] }[] };
    expect(report.checks.find((check) => check.check === 'integrity/policy')?.findings).toMatchObject([{ line: 8 }]);
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace('file_linse', 'file_lines'));
    const corrected = await run(sandbox.path, ['check', '--only', 'bash/syntax', '--no-cache', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('a loosening without a reason is a finding of integrity/policy, and the rest of the policy runs', async () => {
    const policy =
        'version = 1\nconfigurations = ["bash"]\nrequire_reasons = true\n[rules]\ninstall = false\n[limits]\nfile_lines = 1000\n';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.sh': 'echo example\n' });
    const checked = await run(sandbox.path, ['check', '--only', 'bash/syntax', '--no-cache', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = JSON.parse(checked.stdout) as { checks: { check: string; status: string; findings: unknown[] }[] };
    expect(report.checks).toMatchObject([
        { check: 'bash/syntax', status: 'ok' },
        {
            check: 'integrity/policy',
            status: 'fail',
            findings: [{ file: 'gspot.toml', line: 7, message: expect.stringContaining('limits.file_lines') }],
        },
    ]);
    const listed = await run(sandbox.path, ['list', '--json']);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const applied = await run(sandbox.path, ['apply']);
    expect(applied.code).toBe(2);
    expect(applied.stdout + applied.stderr).toContain('gspot.toml:7:');
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace('1000', '200'));
    const corrected = await run(sandbox.path, ['check', '--only', 'bash/syntax', '--no-cache', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as { checks: { check: string }[] }).checks).toMatchObject([
        { check: 'bash/syntax' },
    ]);
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
