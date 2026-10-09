// Policy errors name their gspot.toml key path.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { runGspot, checkReport, buildRunOptions } from '#tests/harness/gspot.ts';

test.each([
    { scope: 'root', policy: buildPolicy(['bas']), where: 'configurations.0' },
    {
        scope: 'nested',
        policy: buildPolicy([], { tables: '[scope."api"]\nconfigurations = ["bas"]\n' }),
        where: 'scope.api.configurations.0',
    },
])('unknown configurations in the $scope scope identify their declaration', async ({ policy, where }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/example.toml': 'value = 1\n' });
    const invalid = await runGspot(sandbox.path, ['list', '--json']);
    expect(invalid.code).toBe(2);
    const diagnostic = JSON.parse(invalid.stdout) as CommandFailureJson;
    expect(diagnostic.message).toContain(`gspot.toml: ${where}:`);
    expect(diagnostic.message).toContain('bash');
});

test('a nested unknown setting is a finding at its key path', async () => {
    const policy = buildPolicy(['bash'], {
        tables: '[agent_rules]\nenabled = false\n[scope."api"]\n[scope."api".limits]\nfile_linse = 200\n',
    });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/source.sh': 'echo example\n' });
    const invalid = await checkReport(sandbox.path, ['check', '--only', 'bash/bash-syntax', '--json']);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    const report = invalid.report;
    expect(report.checks.find((check) => check.check === 'gspot/policy')?.findings).toMatchObject([
        { message: textContaining('scope.api.limits.file_linse:') },
    ]);
});

test('a loosening without a reason is a finding of gspot/policy, and the rest of the policy runs', async () => {
    const policy = buildPolicy(['bash'], {
        tables: '[agent_rules]\nenabled = false\n[limits]\nfile_lines = 1000\n',
    });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.sh': 'echo example\n' });
    const checked = await checkReport(sandbox.path, ['check', '--only', 'bash/bash-syntax', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = checked.report;
    expect(report.checks).toMatchObject([
        { check: 'bash/bash-syntax', status: 'passed' },
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
});

test.each(['\n', '\r\n'])('configuration errors name the key path in text and JSON with %j lines', async (newline) => {
    await using sandbox = await testdir();
    const policy = ['configurations = []', 'runner = "wrong"', ''].join(newline);
    await createFileTree(sandbox.path, { 'gspot.toml': policy });
    const text = await runGspot(sandbox.path, ['check']);
    expect(text.code).toBe(2);
    expect(text.stdout + text.stderr).toContain('gspot.toml: runner:');
    const json = await runGspot(sandbox.path, ['check', '--only', 'naming/policy', '--json']);
    expect(json.code).toBe(2);
    expect(JSON.parse(json.stdout)).toMatchObject({
        error: 'policy',
        message: textContaining('gspot.toml: runner:'),
    });
});

test('a malformed reason reports a policy error and apply preserves the authored policy', async () => {
    await using sandbox = await testdir();
    const source = buildPolicy(['site'], {
        tables: '[limits]\nfile_lines = 1000\n[reasons]\n"limits.file_lines" = 42\n',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': source });
    const diagnostic = 'gspot.toml: reasons.limits.file_lines: Invalid input: expected string, received number';
    const checked = await runGspot(sandbox.path, ['check', '--only', 'naming/policy', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(JSON.parse(checked.stdout)).toStrictEqual({ error: 'policy', message: diagnostic });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(applied.stdout + applied.stderr).toContain(diagnostic);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(source);
    expect(await pathExists(join(sandbox.path, '.gspot'))).toBe(false);
});

test.each(['recommended', 'all'] as const)(
    '%s declares gspot/policy once and retains ordinary and message-stage error behavior',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['bash'], { level, tables: '[agent_rules]\nenabled = false\n' });
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.sh': 'echo example\n' });
        const explained = await runGspot(sandbox.path, ['explain', 'gspot/policy', '--json']);
        expect(explained.code, explained.stdout + explained.stderr).toBe(0);
        expect(JSON.parse(explained.stdout)).toMatchObject({ kind: 'check', subject: 'gspot/policy' });
        const listed = await runGspot(sandbox.path, ['list', '--json']);
        expect(listed.code, listed.stdout + listed.stderr).toBe(0);
        expect(listed.stdout).toContain('gspot/policy');
        const valid = await checkReport(sandbox.path, ['check', '--only', 'gspot/policy', '--json']);
        expect(valid.code, valid.stdout + valid.stderr).toBe(0);
        expect(valid.report.checks).toStrictEqual([]);
        await Bun.write(join(sandbox.path, 'gspot.toml'), policy + '[limits]\nfile_linse = 200\n');
        const session = await openSession(sandbox.path);
        for (const stage of ['all', 'commit', 'push'] as const) {
            const invalid = await executeRun(session, buildRunOptions({ only: ['gspot/policy'], stage }));
            expect(invalid.report.checks).toMatchObject([
                {
                    check: 'gspot/policy',
                    status: 'failed',
                    findings: [{ message: textContaining('limits.file_linse:') }],
                },
            ]);
            expect(invalid.report.checks).toHaveLength(1);
        }
        const message = await executeRun(session, buildRunOptions({ only: ['gspot/policy'], stage: 'message' }));
        expect(message.report.checks).toStrictEqual([]);
    },
);
