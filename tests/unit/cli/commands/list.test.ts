import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { readTree, pathExists } from '#tests/setup/files.ts';
import { listSuggestions } from '#cli/commands/doctor/suggestions.ts';
import { NESTED_SCOPES_SETTINGS } from '#tests/config/settings/scopes.ts';
import type { SettingsListJson, ConfigurationsListJson } from '#cli/types/commands/list.ts';

test('list shows selected settings and available configurations while doctor keeps suggestions without writing', async () => {
    await using directory = await testdir();
    const settings = settingsText(['bash', 'nextjs'], {
        tables: `[[ignore]]
check = "bash/bash-syntax"
reason = "Review this separately."
`,
    });
    await createFileTree(directory.path, {
        'gspot.toml': settings,
        'entry.sh': 'echo example\n',
        'query.sql': 'SELECT 1;\n',
    });
    const before = await readTree(directory.path);
    const listed = await runGspot(directory.path, ['list', 'configurations', '--json']);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const result = JSON.parse(listed.stdout) as ConfigurationsListJson;
    expect(Object.keys(result)).toStrictEqual(['selected', 'available']);
    const checks = result.selected.flatMap((configuration) => configuration.checks);
    expect(checks).toContainEqual({ name: 'bash/shellcheck', scope: '', state: 'on' });
    expect(checks).toContainEqual({ name: 'bash/bash-syntax', scope: '', state: 'off (ignore)' });
    expect(checks).toContainEqual({ name: 'bash/shfmt', scope: '', state: 'on' });
    expect(checks).toContainEqual({ name: 'structure/shared-prefixes', scope: '', state: 'off (level)' });
    expect(checks).toContainEqual({ name: 'nextjs/build', scope: '', state: 'off (level)' });
    expect(
        listSuggestions(await openSession(directory.path)).detected.find(
            (configuration) => configuration.configuration === 'sql',
        )?.command,
    ).toBe('gspot add sql');
    expect(result.available.some((configuration) => configuration.name === 'sql')).toBe(true);
    expect(result.available.some((configuration) => configuration.name === 'python')).toBe(true);
    const defaults = await runGspot(directory.path, ['list', '--json']);
    expect(defaults.code, defaults.stdout + defaults.stderr).toBe(0);
    expect(JSON.parse(defaults.stdout)).toStrictEqual(result);
    const listedSettings = await runGspot(directory.path, ['list', 'settings', '--json']);
    expect(listedSettings.code, listedSettings.stdout + listedSettings.stderr).toBe(0);
    const rows = (JSON.parse(listedSettings.stdout) as SettingsListJson).settings;
    expect(rows.find((row) => row.key === 'level')?.value).toBe('recommended');
    const invalid = await runGspot(directory.path, ['list', 'unknown']);
    expect(invalid.code).toBe(2);
    expect(invalid.stdout + invalid.stderr).toContain('unknown');
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(settings);
    expect(await pathExists(join(directory.path, '.gspot'))).toBe(false);
    expect(await readTree(directory.path)).toStrictEqual(before);
});

test('the text configuration list shows the selected names of the JSON list', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['bash']),
        'entry.sh': 'echo example\n',
    });
    const before = await readTree(directory.path);
    const structured = await runGspot(directory.path, ['list', 'configurations', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    const result = JSON.parse(structured.stdout) as ConfigurationsListJson;
    const human = await runGspot(directory.path, ['list', 'configurations']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stderr).toBe('');
    expect(human.stdout).toStartWith('selected\n');
    for (const configuration of result.selected) expect(human.stdout).toContain(`  ${configuration.name}\n`);
    expect(await readTree(directory.path)).toStrictEqual(before);
});

test('the text check list puts the states of all scopes in one row', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['bash'], {
            tables: `[[ignore]]
check = "bash/bash-syntax"
paths = ["api/**"]
reason = "Review scoped syntax separately."
[[scope]]
path = "api"
[[scope]]
path = "api/worker"
`,
        }),
        'entry.sh': 'echo root\n',
        'api/entry.sh': 'echo api\n',
        'api/worker/entry.sh': 'echo worker\n',
    });
    const before = await readTree(directory.path);
    const structured = await runGspot(directory.path, ['list', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    const { selected } = JSON.parse(structured.stdout) as ConfigurationsListJson;
    const checks = selected.flatMap((configuration) => configuration.checks);
    expect(checks.filter((check) => check.name === 'bash/bash-syntax')).toStrictEqual([
        { name: 'bash/bash-syntax', scope: '', state: 'on' },
        { name: 'bash/bash-syntax', scope: 'api', state: 'off (ignore)' },
        { name: 'bash/bash-syntax', scope: 'api/worker', state: 'off (ignore)' },
    ]);
    const human = await runGspot(directory.path, ['list']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stderr).toBe('');
    expect(human.stdout).toContain('    bash/bash-syntax  root: on, api: off (ignore), api/worker: off (ignore)\n');
    for (const name of new Set(checks.map((check) => check.name)))
        expect(human.stdout.split('\n').filter((line) => line.trimStart().startsWith(`${name} `))).toHaveLength(1);
    expect(await readTree(directory.path)).toStrictEqual(before);
});

test('the text settings list shows scope values while JSON keeps inherited values', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': NESTED_SCOPES_SETTINGS.replace('["format"]', '["bash", "format"]'),
        'api/entry.sh': 'echo api\n',
        'api/worker/query.sql': 'SELECT 1;\n',
    });
    const before = await readTree(directory.path);
    const human = await runGspot(directory.path, ['list', 'settings']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stderr).toBe('');
    const limits = human.stdout.split('\n').filter((line) => line.startsWith('limits.file_lines '));
    expect(limits).toHaveLength(2);
    expect(limits[0]).toContain('250');
    expect(limits[0]).toContain('gspot.toml');
    expect(limits[1]).toContain('200');
    expect(limits[1]).toContain('[scope "api"]  [scope api]');
    expect(limits.join('\n')).not.toContain('[scope api/worker]');
    const structured = await runGspot(directory.path, ['list', 'settings', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    const { settings } = JSON.parse(structured.stdout) as SettingsListJson;
    expect(settings.find((row) => row.key === 'test_files')?.reason_needed).toBeUndefined();
    expect(settings.find((row) => row.key === 'limits.file_lines')?.reason_needed).toBe('raising');
    expect(settings.find((row) => row.scope === 'api/worker' && row.key === 'limits.file_lines')).toMatchObject({
        value: 200,
        source: '[scope "api"]',
    });
    expect(await readTree(directory.path)).toStrictEqual(before);
});

test('the text settings list shortens long values and names extra tool options', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['bash'], {
            tables: `[naming]
banned_words = ["generated-long-name-one/**", "generated-long-name-two/**"]
[tools.shellcheck]
extra = { value = { external_sources = true }, reason = "ShellCheck follows the authored external sources." }
`,
        }),
        'entry.sh': 'echo example\n',
    });
    const before = await readTree(directory.path);
    const human = await runGspot(directory.path, ['list', 'settings']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stderr).toBe('');
    expect(human.stdout).toMatch(/^naming\.banned_words\s+\["generated-long-name-one\/\*… /mu);
    expect(human.stdout).not.toContain('generated-long-name-two');
    expect(human.stdout).toContain('\nextra tool options (gspot passes them on unchecked)\n');
    expect(human.stdout).toContain(
        'tools.shellcheck.extra  external_sources  ShellCheck follows the authored external sources.',
    );
    const structured = await runGspot(directory.path, ['list', 'settings', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    const { settings, extras } = JSON.parse(structured.stdout) as SettingsListJson;
    expect(settings.find((row) => row.key === 'naming.banned_words')?.value).toStrictEqual([
        'generated-long-name-one/**',
        'generated-long-name-two/**',
    ]);
    expect(settings.find((row) => row.key === 'tools.shellcheck.extra')).toMatchObject({
        value: { external_sources: true },
        source: 'gspot.toml',
    });
    expect(settings.some((row) => row.key === 'tools.eslint.extra')).toBe(false);
    expect(extras).toStrictEqual([
        {
            tool: 'shellcheck',
            keys: ['external_sources'],
            reason: 'ShellCheck follows the authored external sources.',
            scope: '',
        },
    ]);
    expect(await readTree(directory.path)).toStrictEqual(before);
});
