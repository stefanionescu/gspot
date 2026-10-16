import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { parse } from '@decimalturn/toml-patch';
import { getValueAt } from '#cli/system/values.ts';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { isOnDisk, readTree } from '#tests/setup/files.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { matchItems, matchFields } from '#tests/setup/matchers.ts';
import { commitAll, readGitOutput, prepareAppliedBashRepository } from '#tests/setup/git.ts';

import {
    SET_SETTINGS,
    TAPLO_REASON,
    TAPLO_OPTIONS,
    RESTRICTED_IMPORTS,
    EXTRA_OPTION_SCOPES,
} from '#tests/data/commands/set.ts';

test('unignore restores the missing-license finding', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['docs'], { level: 'all' }),
        'README.md': '# Example\n',
    });
    const ignored = await runGspot(sandbox.path, [
        'ignore',
        'docs/required-files',
        '--rule',
        'missing-license',
        '--reason',
        'The example repository has no published license.',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const relaxed = await checkReport(sandbox.path, ['check', '--only', 'docs/required-files', '--json']);
    expect(
        relaxed.report.checks.flatMap(({ findings }) => findings).some(({ rule }) => rule === 'missing-license'),
    ).toBe(false);
    const restored = await runGspot(sandbox.path, ['unignore', 'docs/required-files', '--rule', 'missing-license']);
    expect(restored.code, restored.stdout + restored.stderr).toBe(0);
    const missing = await checkReport(sandbox.path, ['check', '--only', 'docs/required-files', '--json']);
    expect(missing.code, missing.stdout + missing.stderr).toBe(1);
    expect(missing.report.checks.flatMap(({ findings }) => findings)).toContainEqual(
        matchFields({ file: 'LICENSE', rule: 'missing-license' }),
    );
});

test.each([
    [
        'a scope-only key without --scope',
        ['set', 'tools.shellcheck.extra', '{ external_sources = true }'],
        '--scope api',
    ],
    [
        'a rule turned off',
        ['set', 'tools.markdownlint.rules', '{ MD013 = false }'],
        'gspot ignore markdown/markdownlint --rule <rule> --reason',
    ],
    ['a key without a value', ['set', 'limits.file_lines'], "Missing required argument 'values'"],
    [
        'an undeclared scope',
        ['set', 'limits.file_lines', '100', '--scope', 'web'],
        'gspot.toml has no [[scope]] with path = "web". Add one, or leave out --scope.',
    ],
])('set refuses %s', async (_, commandArguments, expected) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': SET_SETTINGS,
        'api/entry.sh': 'echo api\n',
        'web/index.md': '# Web\n',
    });
    const before = await readTree(sandbox.path);
    const refused = await runGspot(sandbox.path, commandArguments);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout).toBe('');
    expect(refused.stderr).toContain(expected);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(SET_SETTINGS);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const structured = await runGspot(sandbox.path, [...commandArguments, '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    const failure = JSON.parse(structured.stdout) as CommandFailureJson;
    expect(failure.error).toBe(commandArguments[1] === 'tools.markdownlint.rules' ? 'settings' : 'arguments');
    expect(failure.message).toContain(expected);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test.each(['tools.taplo.unknown', 'tools.eslint.extra', 'tools.v8r.extra'])(
    'set refuses the unknown or unavailable key %s and writes nothing',
    async (key) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['files']),
            'settings.toml': 'enabled = true\n',
        });
        const before = await readTree(sandbox.path);
        const refused = await runGspot(sandbox.path, ['set', key, '{ enabled = true }', '--reason', TAPLO_REASON]);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stderr).toContain(key);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test('an invalid level leaves gspot.toml as it was', async () => {
    await using sandbox = await testdir();
    const settingsPath = join(sandbox.path, 'gspot.toml');
    const settings = buildSettingsText(['bash', 'naming']);
    await Bun.write(settingsPath, settings);
    const refused = await runGspot(sandbox.path, ['set', 'level', 'everything']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr.trim()).toBe('The value `everything` is not valid for level. Use recommended or all.');
    expect(refused.stderr.trim().split('\n')).toHaveLength(1);
    expect(await Bun.file(settingsPath).text()).toBe(settings);
});

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
])('%s keeps its change in gspot.toml and exits 2 when apply then stops', async (_, commandArguments, written) => {
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
    const stopped = await runGspot(sandbox.path, commandArguments);
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
            'gspot.toml': buildSettingsText(['files'], { tables: '[[scope]]\npath = "app"\n' }),
            'app/settings.toml': 'enabled = true\n',
        });
        const key = 'tools.taplo.extra';
        const scopeArguments = scope === '' ? [] : ['--scope', scope];
        const commandArguments = ['set', key, '{ compact_inline_tables = true }', ...scopeArguments];
        const before = await readTree(sandbox.path);
        const refused = await runGspot(sandbox.path, commandArguments);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stderr).toContain('reason');
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        const written = await runGspot(sandbox.path, [...commandArguments, '--reason', TAPLO_REASON]);
        expect(written.code, written.stdout + written.stderr).toBe(0);
        const explained = await runGspot(sandbox.path, ['explain', key, '--json']);
        expect(explained.code, explained.stdout + explained.stderr).toBe(0);
        expect(JSON.parse(explained.stdout)).toMatchObject({
            key,
            scopes: matchItems([{ scope, current: TAPLO_OPTIONS, reason: TAPLO_REASON, source }]),
        });
        if (scope === '') {
            const generated = parse(
                await readFile(join(sandbox.path, '.gspot/config/taplo.toml'), 'utf8'),
            ) as TomlTable;
            expect(generated['formatting']).toMatchObject(TAPLO_OPTIONS);
        }
        expect(await isOnDisk(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
        const reset = await runGspot(sandbox.path, ['unset', key, ...scopeArguments]);
        expect(reset.code, reset.stdout + reset.stderr).toBe(0);
        const next = readSettings(sandbox.path, createReadCache(process.cwd())).settings;
        const table = scope === '' ? next.written : next.scopes[scope]?.written;
        expect(getValueAt(table, ['tools', 'taplo', 'extra'])).toBeUndefined();
        expect(await readFile(join(sandbox.path, 'app/settings.toml'), 'utf8')).toBe('enabled = true\n');
    },
);

test('gspot set writes a list of tables typed the TOML way as tables, and the settings refuses quoted ones', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'README.md': '# test\n',
        'gspot.toml': buildSettingsText(['docs', 'javascript']),
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
        buildSettingsText(['docs', 'javascript'], {
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
    await prepareAppliedBashRepository(source);
    readGitOutput(sandbox.path, ['clone', '--quiet', source, checkout]);
    expect(await isOnDisk(join(checkout, '.gspot/state/ownership.json'))).toBe(false);
    const changed = await runGspot(checkout, ['set', 'level', 'all']);
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    expect(readSettings(checkout, createReadCache(process.cwd())).settings.level).toBe('all');
});

test.each([
    {
        commandArguments: ['unset', 'configurations'],
        message: 'Use gspot add or gspot remove to change configurations.',
    },
    { commandArguments: ['unset', 'no_such_key'], message: 'no_such_key' },
    {
        commandArguments: ['unset', 'level', 'extra'],
        message: 'level is not a list, so it takes no items. Run gspot unset level.',
    },
])('gspot $argv refuses the change and preserves gspot.toml', async ({ commandArguments, message }) => {
    await using sandbox = await testdir({ 'gspot.toml': buildSettingsText([]) });
    const path = join(sandbox.path, 'gspot.toml');
    const before = await Bun.file(path).text();
    const result = await runGspot(sandbox.path, commandArguments);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain(message);
    expect(await Bun.file(path).text()).toBe(before);
});
