import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import type { SettingsListJson, ConfigurationsListJson } from '#cli/types/commands/list.ts';
import { LIST_SCOPE_ROWS, LIST_SCOPE_SETTINGS, SHFMT_IGNORE_SETTINGS } from '#tests/config/commands/list.ts';

test('list shows selected settings and available configurations', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['bash', 'nextjs'], SHFMT_IGNORE_SETTINGS);
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'entry.sh': 'echo example\n',
        'query.sql': 'SELECT 1;\n',
    });
    const before = await readTree(sandbox.path);
    const listed = await runGspot(sandbox.path, ['list', 'configurations', '--json']);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const result = JSON.parse(listed.stdout) as ConfigurationsListJson;
    expect(Object.keys(result)).toStrictEqual(['selected', 'available']);
    const checks = result.selected.flatMap((configuration) => configuration.checks);
    const named = new Set(['bash/shellcheck', 'bash/shfmt', 'structure/shared-prefixes']);
    expect(checks.filter(({ name }) => named.has(name))).toStrictEqual([
        { name: 'bash/shellcheck', scope: '', state: 'on' },
        { name: 'bash/shfmt', scope: '', state: 'off (ignore)' },
        { name: 'structure/shared-prefixes', scope: '', state: 'off (level)' },
    ]);
    expect(
        [...result.selected, ...result.available]
            .map(({ name }) => name)
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual([...readConfigurations().keys()].toSorted((left, right) => left.localeCompare(right)));
    const defaults = await runGspot(sandbox.path, ['list', '--json']);
    expect(defaults.code, defaults.stdout + defaults.stderr).toBe(0);
    expect(JSON.parse(defaults.stdout)).toStrictEqual(result);
    const listedSettings = await runGspot(sandbox.path, ['list', 'settings', '--json']);
    expect(listedSettings.code, listedSettings.stdout + listedSettings.stderr).toBe(0);
    const rows = (JSON.parse(listedSettings.stdout) as SettingsListJson).settings;
    expect(rows.find((row) => row.key === 'level')?.value).toBe('recommended');
    const invalid = await runGspot(sandbox.path, ['list', 'unknown']);
    expect(invalid.code).toBe(2);
    expect(invalid.stdout + invalid.stderr).toBe(
        "Command-argument value 'unknown' is invalid for argument 'kind'. Allowed choices are configurations, settings.\n",
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('the text configuration list shows the selected names of the JSON list', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });

    const before = await readTree(sandbox.path);
    const structured = await runGspot(sandbox.path, ['list', 'configurations', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    const result = JSON.parse(structured.stdout) as ConfigurationsListJson;
    const human = await runGspot(sandbox.path, ['list', 'configurations']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stderr).toBe('');
    expect(human.stdout).toStartWith('selected\n');
    for (const configuration of result.selected) expect(human.stdout).toContain(`  ${configuration.name}\n`);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('the text check list puts the states of all scopes in one row', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], {
            tables: '[[ignore]]\ncheck = "bash/shfmt"\npaths = ["api/**"]\nreason = "Review scoped syntax separately."\n',
            scopes: [{ path: 'api' }, { path: 'api/worker' }],
        }),
        'entry.sh': 'echo root\n',
        'api/entry.sh': 'echo api\n',
        'api/worker/entry.sh': 'echo worker\n',
    });

    const before = await readTree(sandbox.path);
    const structured = await runGspot(sandbox.path, ['list', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    const { selected } = JSON.parse(structured.stdout) as ConfigurationsListJson;
    const checks = selected.flatMap((configuration) => configuration.checks);
    expect(checks.filter((check) => check.name === 'bash/shfmt')).toStrictEqual([
        { name: 'bash/shfmt', scope: '', state: 'on' },
        { name: 'bash/shfmt', scope: 'api', state: 'off (ignore)' },
        { name: 'bash/shfmt', scope: 'api/worker', state: 'off (ignore)' },
    ]);
    const human = await runGspot(sandbox.path, ['list']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stderr).toBe('');
    expect(human.stdout).toContain('    bash/shfmt  root: on, api: off (ignore), api/worker: off (ignore)\n');
    for (const name of new Set(checks.map((check) => check.name)))
        expect(human.stdout.split('\n').filter((line) => line.trimStart().startsWith(`${name} `))).toHaveLength(1);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('the text settings list shows scope values while JSON keeps inherited values', async () => {
    await using sandbox = await testdir({
        'gspot.toml': LIST_SCOPE_SETTINGS,
        'api/entry.sh': 'echo api\n',
        'api/worker/query.sql': 'SELECT 1;\n',
    });

    const before = await readTree(sandbox.path);
    const human = await runGspot(sandbox.path, ['list', 'settings']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stderr).toBe('');
    const lines = human.stdout.split('\n');
    const selected = lines.filter((line) =>
        /^(?:limits\.file_lines|test_files|dependencies\.(?:min_release_age_days|allowed_registries)) /u.test(line),
    );
    expect(selected).toStrictEqual([...LIST_SCOPE_ROWS]);
    const structured = await runGspot(sandbox.path, ['list', 'settings', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    const { settings } = JSON.parse(structured.stdout) as SettingsListJson;
    expect(settings.find((row) => row.key === 'test_files')?.reason_needed).toBeUndefined();
    expect(settings.find((row) => row.key === 'limits.file_lines')?.reason_needed).toBe('raising');
    expect(settings.find((row) => row.scope === 'api/worker' && row.key === 'limits.file_lines')).toMatchObject({
        value: 200,
        source: '[scope "api"]',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('the text settings list shortens long values', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], {
            tables: '[naming]\nbanned_words = ["generated-long-name-one/**", "generated-long-name-two/**"]\n',
        }),
        'entry.sh': 'echo example\n',
    });
    const before = await readTree(sandbox.path);
    const human = await runGspot(sandbox.path, ['list', 'settings']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stderr).toBe('');
    expect(human.stdout).toMatch(/^naming\.banned_words\s+\["generated-long-name-one\/\*… /mu);
    expect(human.stdout).not.toContain('generated-long-name-two');
    const structured = await runGspot(sandbox.path, ['list', 'settings', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    const report = JSON.parse(structured.stdout) as SettingsListJson;
    expect(report.settings.find((row) => row.key === 'naming.banned_words')?.value).toStrictEqual([
        'generated-long-name-one/**',
        'generated-long-name-two/**',
    ]);
    expect(Object.keys(report)).toStrictEqual(['settings']);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});
