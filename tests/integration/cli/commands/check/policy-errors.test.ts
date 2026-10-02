// Policy errors name their gspot.toml key path and accept the suggested correction.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { runGspot } from '#tests/harness/cli/command.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import type { CommandFailureJson } from '#cli/types/commands/commands.ts';

test.each([
    { scope: 'root', policy: policyOf(['bas']), where: 'kits.0' },
    {
        scope: 'nested',
        policy: policyOf([], '[[scope]]\npath = "api"\nkits = ["bas"]\n'),
        where: 'scope.0.kits.0',
    },
])(
    'unknown kits in the $scope scope identify their declaration and accept the suggested configuration',
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
    const policy = policyOf(
        ['bash'],
        '[rules]\ninstall = false\n[[scope]]\npath = "api"\n[scope.limits]\nfile_linse = 200\n',
    );
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/source.sh': 'echo example\n' });
    const invalid = await runGspot(sandbox.path, ['check', '--only', 'bash/syntax', '--json']);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    const report = JSON.parse(invalid.stdout) as { checks: { check: string; findings: { message: string }[] }[] };
    expect(report.checks.find((check) => check.check === 'gspot/policy')?.findings).toMatchObject([
        { message: textContaining('scope.0.limits.file_linse:') },
    ]);
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace('file_linse', 'file_lines'));
    const corrected = await runGspot(sandbox.path, ['check', '--only', 'bash/syntax', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('a loosening without a reason is a finding of gspot/policy, and the rest of the policy runs', async () => {
    const policy = policyOf(
        ['bash'],
        'require_reasons = true\n[rules]\ninstall = false\n[limits]\nfile_lines = 1000\n',
    );
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.sh': 'echo example\n' });
    const checked = await runGspot(sandbox.path, ['check', '--only', 'bash/syntax', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = JSON.parse(checked.stdout) as { checks: { check: string; status: string; findings: unknown[] }[] };
    expect(report.checks).toMatchObject([
        { check: 'bash/syntax', status: 'ok' },
        {
            check: 'gspot/policy',
            status: 'fail',
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
    expect((JSON.parse(corrected.stdout) as { checks: { check: string }[] }).checks).toMatchObject([
        { check: 'bash/syntax' },
    ]);
});

test.each(['\n', '\r\n'])('configuration errors name the key path in text and JSON with %j lines', async (newline) => {
    await using sandbox = await testdir();
    const policy = ['kits = []', 'require_reasons = "wrong"', ''].join(newline);
    await createFileTree(sandbox.path, { 'gspot.toml': policy });
    const text = await runGspot(sandbox.path, ['check']);
    expect(text.code).toBe(2);
    expect(text.stdout + text.stderr).toContain('gspot.toml: require_reasons:');
    const json = await runGspot(sandbox.path, ['check', '--json']);
    expect(json.code).toBe(2);
    expect(JSON.parse(json.stdout)).toMatchObject({
        error: 'policy',
        message: textContaining('gspot.toml: require_reasons:'),
    });
    writeFileSync(join(sandbox.path, 'gspot.toml'), policy.replace('"wrong"', 'true'));
    const corrected = await runGspot(sandbox.path, ['check', '--json']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
