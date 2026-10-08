// What gspot set refuses, run through the command, and what set and ignore keep when apply stops after them.
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { readPolicy } from '#cli/policy/read.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { valueAt } from '#cli/platform/objects.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { knownSettings } from '#cli/policy/settings/known.ts';
import { settingValue } from '#cli/policy/settings/lookup.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { readTree, pathExists } from '#tests/harness/preservation.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { TAPLO_REASON, TAPLO_OPTIONS } from '#tests/config/samples/taplo.ts';

import {
    POLICY,
    ESLINT_OVERRIDES,
    NATIVE_OPTION_SCOPES,
    SET_CONFLICT_POLICIES,
    ESLINT_OVERRIDE_REASON,
    SET_ARGUMENT_CONFLICTS,
} from '#tests/config/cli/commands/set.ts';

test.each(
    SET_ARGUMENT_CONFLICTS.flatMap((entry) =>
        SET_CONFLICT_POLICIES.map(({ name, policy }) => ({ ...entry, policy, policyName: name })),
    ),
)(
    'set refuses $name with $policyName before reading policy or writing state',
    async ({ argv, message: diagnostic, policy }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'control.txt': 'preserve this source\n' });
        const before = await readTree(sandbox.path);
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
            expect(await readTree(sandbox.path)).toStrictEqual(before);
        }
    },
);

test.each([
    [
        'a scope-only key without --scope',
        ['set', 'tools.shellcheck.verbatim', '{"external_sources": true}'],
        '--scope api',
    ],
    [
        'a rule turned off',
        ['set', 'tools.markdownlint.rules', '{"MD013": false}'],
        'gspot ignore markdown/markdownlint --rule <rule> --reason',
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
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, argv);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout).toBe('');
    expect(refused.stderr).toContain(expected);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(POLICY);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...argv, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    const failure = JSON.parse(structured.stdout) as CommandFailureJson;
    expect(failure.error).toBe('policy');
    expect(failure.message).toContain(expected);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each([
    [
        'set',
        ['set', 'limits.bash.file_lines', '200', '--reason', 'Generated scripts need this limit.'],
        '[limits.bash]\nfile_lines = 200',
    ],
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
    await chmod(generated, 0o644);
    await writeFile(generated, `${await readFile(generated, 'utf8')}# Edited.\n`);
    const stopped = await runGspot(sandbox.path, argv);
    expect(stopped.code, stopped.stdout + stopped.stderr).toBe(2);
    expect(stopped.stdout).toContain('gspot.toml keeps this change');
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain(written);
});

test.each(NATIVE_OPTION_SCOPES)(
    'set addresses native Taplo options in the $name scope without installing tools',
    async ({ scope, source }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['files'], { tables: '[agent_rules]\nenabled = false\n[scope."app"]\n' }),
            'app/settings.toml': 'enabled = true\n',
        });
        const key = 'tools.taplo.verbatim';
        const scopeArguments = scope === '' ? [] : ['--scope', scope];
        const argv = ['set', key, JSON.stringify(TAPLO_OPTIONS), ...scopeArguments];
        const before = await readTree(sandbox.path);
        const preview = await runGspot(sandbox.path, [...argv, '--reason', TAPLO_REASON, '--dry-run']);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect(preview.stdout).toContain('compact_inline_tables = true');
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        const refused = await runGspot(sandbox.path, argv);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stderr).toContain('[reasons]');
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        const written = await runGspot(sandbox.path, [...argv, '--reason', TAPLO_REASON]);
        expect(written.code, written.stdout + written.stderr).toBe(0);
        const { policy } = readPolicy(sandbox.path);
        const selected = selectForScope(policy, scope, configurationManifests());
        expect(settingValue(knownSettings(selected), policy, key, scope)).toMatchObject({
            value: TAPLO_OPTIONS,
            reason: TAPLO_REASON,
            source,
        });
        if (scope === '') {
            const generated = parse(await readFile(join(sandbox.path, '.gspot/config/taplo.toml'), 'utf8'));
            expect(generated['formatting']).toMatchObject(TAPLO_OPTIONS);
        }
        expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
        const reset = await runGspot(sandbox.path, ['set', key, '--default', ...scopeArguments]);
        expect(reset.code, reset.stdout + reset.stderr).toBe(0);
        const next = readPolicy(sandbox.path).policy;
        const table = scope === '' ? next.authored : next.scopeTables[scope]?.authored;
        expect(valueAt(table, ['tools', 'taplo', 'verbatim'])).toBeUndefined();
        expect(valueAt(table, ['reasons', key])).toBeUndefined();
        expect(await readFile(join(sandbox.path, 'app/settings.toml'), 'utf8')).toBe('enabled = true\n');
    },
);

test('set retains native ESLint override records and their outer reason', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], { tables: '[agent_rules]\nenabled = false\n' }),
        'src/example.js': 'export const value = 1;\n',
    });
    const before = await readTree(sandbox.path);
    const argv = [
        'set',
        'tools.eslint.overrides',
        JSON.stringify(ESLINT_OVERRIDES),
        '--replace',
        '--reason',
        ESLINT_OVERRIDE_REASON,
    ];
    const preview = await runGspot(sandbox.path, [...argv, '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const written = await runGspot(sandbox.path, argv);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const { policy } = readPolicy(sandbox.path);
    expect(policy.authored.tools?.eslint?.overrides).toStrictEqual(ESLINT_OVERRIDES);
    expect(policy.authored.reasons?.['tools.eslint.overrides']).toBe(ESLINT_OVERRIDE_REASON);
    expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
});

test.each(['tools.taplo.unknown', 'tools.eslint.verbatim', 'tools.v8r.verbatim'])(
    'set refuses the unknown or unavailable native key %s without writes',
    async (key) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['files']),
            'settings.toml': 'enabled = true\n',
        });
        const before = await readTree(sandbox.path);
        const refused = await runGspot(sandbox.path, ['set', key, '{"enabled": true}', '--reason', TAPLO_REASON]);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stderr).toContain(key);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);
