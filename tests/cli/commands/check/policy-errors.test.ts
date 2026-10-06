// Policy errors name their gspot.toml key path and accept the suggested correction.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { CommandFailureJson } from '#cli/types/output.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';

test.each([
    { scope: 'root', policy: buildPolicy(['bas']), where: 'configurations.0' },
    {
        scope: 'nested',
        policy: buildPolicy([], { tables: '[[scope]]\npath = "api"\nconfigurations = ["bas"]\n' }),
        where: 'scope.0.configurations.0',
    },
])(
    'unknown configurations in the $scope scope identify their declaration and accept the suggested configuration',
    async ({ policy, where }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/example.toml': 'value = 1\n' });
        const invalid = await runGspot(sandbox.path, ['list', '--json']);
        expect(invalid.code).toBe(2);
        const diagnostic = JSON.parse(invalid.stdout) as CommandFailureJson;
        expect(diagnostic.message).toContain(`gspot.toml: ${where}:`);
        expect(diagnostic.message).toContain('bash');
        writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace('"bas"', '"bash"'));
        const corrected = await runGspot(sandbox.path, ['list', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

test('a nested unknown setting is a finding at its key path, and its correction clears it', async () => {
    const policy = buildPolicy(['bash'], {
        tables: '[agent_rules]\nenabled = false\n[[scope]]\npath = "api"\n[scope.limits]\nfile_linse = 200\n',
    });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/source.sh': 'echo example\n' });
    const invalid = await runGspot(sandbox.path, ['check', '--only', 'bash/syntax', '--json']);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    const report = JSON.parse(invalid.stdout) as RunReport;
    expect(report.checks.find((check) => check.check === 'gspot/policy')?.findings).toMatchObject([
        { message: textContaining('scope.0.limits.file_linse:') },
    ]);
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace('file_linse', 'file_lines'));
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'bash/syntax', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('a loosening without a reason is a finding of gspot/policy, and the rest of the policy runs', async () => {
    const policy = buildPolicy(['bash'], {
        tables: 'require_reasons = true\n[agent_rules]\nenabled = false\n[limits]\nfile_lines = 1000\n',
    });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.sh': 'echo example\n' });
    const checked = await runGspot(sandbox.path, ['check', '--only', 'bash/syntax', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = JSON.parse(checked.stdout) as RunReport;
    expect(report.checks).toMatchObject([
        { check: 'bash/syntax', status: 'passed' },
        {
            check: 'gspot/policy',
            status: 'failed',
            findings: [{ file: 'gspot.toml', message: textContaining('limits.file_lines: ') }],
        },
    ]);
    const listed = await runGspot(sandbox.path, ['list', '--json']);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code).toBe(2);
    expect(applied.stdout + applied.stderr).toContain('gspot.toml: limits.file_lines:');
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace('1000', '200'));
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'bash/syntax', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ check: 'bash/syntax' }]);
});

test.each(['\n', '\r\n'])('configuration errors name the key path in text and JSON with %j lines', async (newline) => {
    await using sandbox = await testdir();
    const policy = ['configurations = []', 'require_reasons = "wrong"', ''].join(newline);
    await createFileTree(sandbox.path, { 'gspot.toml': policy });
    const text = await runGspot(sandbox.path, ['check']);
    expect(text.code).toBe(2);
    expect(text.stdout + text.stderr).toContain('gspot.toml: require_reasons:');
    const json = await runGspot(sandbox.path, ['check', '--only', 'naming/policy', '--json']);
    expect(json.code).toBe(2);
    expect(JSON.parse(json.stdout)).toMatchObject({
        error: 'policy',
        message: textContaining('gspot.toml: require_reasons:'),
    });
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace('"wrong"', 'true'));
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'naming/policy', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
