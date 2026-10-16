import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { valueAt } from '#cli/objects.ts';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { knownSettings } from '#cli/settings/view.ts';
import { settingValue } from '#cli/settings/inherit.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { selectForScope } from '#cli/repository/select.ts';
import { commitAll, gitOutput } from '#tests/setup/git.ts';
import { readTree, pathExists } from '#tests/setup/files.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { TAPLO_REASON, TAPLO_OPTIONS, RESTRICTED_IMPORTS, EXTRA_OPTION_SCOPES } from '#tests/config/set.ts';

test.each([
    [
        'set',
        ['set', 'limits.bash.file_lines', '200', '--reason', 'Generated scripts need this limit.'],
        '[limits.bash]\nfile_lines = { value = 200, reason = "Generated scripts need this limit." }',
    ],
    [
        'ignore',
        ['ignore', 'bash/shellcheck', '--paths', 'entry.sh', '--reason', 'Generated from its template.'],
        'check = "bash/shellcheck"',
    ],
])('%s keeps its change in gspot.toml and exits 2 when apply then stops', async (_, argv, written) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `configurations = ["bash", "structure"]
[rules]
enabled = false
`,
        'entry.sh': 'echo example\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const generated = join(sandbox.path, '.editorconfig');
    await chmod(generated, 0o644);
    await writeFile(generated, 'root = true\n');
    const stopped = await runGspot(sandbox.path, argv);
    expect(stopped.code, stopped.stdout + stopped.stderr).toBe(2);
    expect(stopped.stdout).toBe('');
    expect(stopped.stderr).toContain('gspot.toml keeps this change');
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toContain(written);
});

test.each([...EXTRA_OPTION_SCOPES])(
    'set writes extra Taplo options in the $name scope without installing tools, and unset removes them',
    async ({ scope, source }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['files'], { tables: '[[scope]]\npath = "app"\n' }),
            'app/settings.toml': 'enabled = true\n',
        });
        const key = 'tools.taplo.extra';
        const scopeArguments = scope === '' ? [] : ['--scope', scope];
        const argv = ['set', key, '{ compact_inline_tables = true }', ...scopeArguments];
        const before = await readTree(sandbox.path);
        const refused = await runGspot(sandbox.path, argv);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stderr).toContain('reason');
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        const written = await runGspot(sandbox.path, [...argv, '--reason', TAPLO_REASON]);
        expect(written.code, written.stdout + written.stderr).toBe(0);
        const { settings } = readSettings(sandbox.path);
        const selected = selectForScope(settings, scope, configurationManifests());
        expect(settingValue(knownSettings(selected), settings, key, scope)).toMatchObject({
            value: TAPLO_OPTIONS,
            reason: TAPLO_REASON,
            source,
        });
        if (scope === '') {
            const generated = parse(await readFile(join(sandbox.path, '.gspot/config/taplo.toml'), 'utf8'));
            expect(generated['formatting']).toMatchObject(TAPLO_OPTIONS);
        }
        expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
        const reset = await runGspot(sandbox.path, ['unset', key, ...scopeArguments]);
        expect(reset.code, reset.stdout + reset.stderr).toBe(0);
        const next = readSettings(sandbox.path).settings;
        const table = scope === '' ? next.written : next.scopeTables[scope]?.written;
        expect(valueAt(table, ['tools', 'taplo', 'extra'])).toBeUndefined();
        expect(await readFile(join(sandbox.path, 'app/settings.toml'), 'utf8')).toBe('enabled = true\n');
    },
);

test('gspot set writes a list of tables typed the TOML way as tables, and the settings refuses quoted ones', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'README.md': '# test\n',
        'gspot.toml': settingsText(['docs', 'javascript']),
    });
    commitAll(sandbox.path);
    const written = await runGspot(sandbox.path, ['set', 'tools.eslint.restricted_imports', RESTRICTED_IMPORTS]);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    const settings = await Bun.file(join(sandbox.path, 'gspot.toml')).text();
    expect(settings).toContain('name = "unreviewed-module"');
    expect(settings).not.toContain('"[{name');
    const unreadable = await runGspot(sandbox.path, ['set', 'tools.eslint.restricted_imports', '[{name = ']);
    expect(unreadable.code).toBe(2);
    expect(unreadable.stdout + unreadable.stderr).toContain('is not a TOML inline value');
    // A person can still type the quotes by hand, and the settings refuses that when it loads.
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        settingsText(['docs', 'javascript'], {
            tables: `[tools.eslint]\nrestricted_imports = ['{name = "a", message = "Use its public entrypoint."}']\n`,
        }),
    );
    const read = await runGspot(sandbox.path, ['check', '--only', 'docs/required-files', '--json']);
    expect(read.code, read.stdout + read.stderr).toBe(2);
    expect(JSON.parse(read.stdout) as CommandFailureJson).toStrictEqual({
        error: 'settings',
        message: 'gspot.toml: tools.eslint.restricted_imports.0: Invalid input: expected object, received string',
    });
});

test('a fresh clone can change the level without an ownership log', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    const checkout = join(sandbox.path, 'checkout');
    await createFileTree(source, {
        'gspot.toml': settingsText(['bash']),
        'entry.sh': 'echo example\n',
    });
    gitOutput(source, ['init', '-q']);
    expect(await applyCommand({ cwd: source, isDryRun: false })).toHaveProperty('exitCode', 0);
    commitAll(source);
    gitOutput(sandbox.path, ['clone', '--quiet', source, checkout]);
    expect(await pathExists(join(checkout, '.gspot/state/ownership.json'))).toBe(false);
    const changed = await runGspot(checkout, ['set', 'level', 'all']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    expect(readSettings(checkout).settings.level).toBe('all');
});
