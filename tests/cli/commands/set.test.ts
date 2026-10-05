// What gspot set refuses, run through the command, and what set and ignore keep when apply stops after them.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { readTree } from '#tests/harness/preservation.ts';
import type { CommandFailureJson } from '#cli/types/output.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { POLICY, SET_CONFLICT_POLICIES, SET_ARGUMENT_CONFLICTS } from '#tests/config/cli/commands/set.ts';

test.each(
    SET_ARGUMENT_CONFLICTS.flatMap((entry) =>
        SET_CONFLICT_POLICIES.map(({ name, policy }) => ({ ...entry, policy, policyName: name })),
    ),
)(
    'set refuses $name with $policyName before reading policy or writing state',
    async ({ argv, message: diagnostic, policy }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'control.txt': 'preserve this source\n' });
        const before = readTree(sandbox.path);
        for (const command of [argv, ['--json', ...argv], [...argv, '--json']]) {
            const result = await runGspot(sandbox.path, command);
            expect(result.code, result.stdout + result.stderr).toBe(2);
            if (command.includes('--json')) {
                expect(result.stderr).toBe('');
                const failure = JSON.parse(result.stdout) as CommandFailureJson;
                expect(failure.error).toBe('arguments');
                expect(failure.message).toContain(diagnostic);
                expect(failure.message).not.toContain('valid TOML');
            } else {
                expect(result.stdout).toBe('');
                expect(result.stderr).toContain(diagnostic);
                expect(result.stderr).not.toContain('valid TOML');
            }
            expect(readTree(sandbox.path)).toStrictEqual(before);
        }
    },
);

test.each([
    ['a scope-only key without --scope', ['set', 'bash.boundary_roots', 'scripts'], '--scope api'],
    [
        'a tool rule turned off',
        ['set', 'tools.markdownlint.rules', '{"MD013": false}'],
        'gspot ignore markdown/markdownlint --rule MD013 --reason',
    ],
    ['a key without a value', ['set', 'limits.file_lines'], 'needs a value'],
    [
        'an undeclared scope',
        ['set', 'limits.file_lines', '100', '--scope', 'web'],
        'No policy scope matches web. Available scopes: root, api.',
    ],
])('set refuses %s', async (_, argv, expected) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': POLICY,
        'api/entry.sh': 'echo api\n',
        'web/index.md': '# Web\n',
    });
    const before = readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout).toBe('');
    expect(refused.stderr).toContain(expected);
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(POLICY);
    expect(readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...argv, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    const failure = JSON.parse(structured.stdout) as CommandFailureJson;
    expect(failure.error).toBe('policy');
    expect(failure.message).toContain(expected);
    expect(readTree(sandbox.path)).toStrictEqual(before);
});

test.each([
    ['set', ['set', 'limits.bash.file_lines', '200'], '[limits.bash]\nfile_lines = 200'],
    [
        'ignore',
        ['ignore', 'bash/shellcheck', '--paths', 'entry.sh', '--reason', 'Generated from its template.'],
        'check = "bash/shellcheck"',
    ],
])('%s keeps its change in gspot.toml and exits 2 when apply then stops', async (_, argv, written) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["bash", "structure"]\n[agent_rules]\nenabled = false\n',
        'entry.sh': 'echo example\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const generated = join(sandbox.path, '.gspot/config/shellcheckrc');
    chmodSync(generated, 0o644);
    writeFileSync(generated, `${readFileSync(generated, 'utf8')}# Edited.\n`);
    const stopped = await runGspot(sandbox.path, argv);
    expect(stopped.code, stopped.stdout + stopped.stderr).toBe(2);
    expect(stopped.stdout).toContain('gspot.toml keeps this change');
    expect(readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain(written);
});
