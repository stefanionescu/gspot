import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { compareText } from '#cli/system/text.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGspot, assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';
import type { SettingsListJson, ConfigurationsListJson } from '#cli/types/commands/reports.ts';
import { OFF_BY_IGNORE, LIST_SCOPE_SETTINGS, SHFMT_IGNORE_SETTINGS } from '#tests/config/commands/reports.ts';

test('list shows selected settings and available configurations', async () => {
    await using sandbox = await createGitSandbox({});
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
    const checks = result.selected.flatMap((configuration) => configuration.checks);
    const named = new Set(['bash/shellcheck', 'bash/shfmt', 'structure/shared-prefixes']);
    expect(checks.filter(({ check }) => named.has(check))).toStrictEqual([
        { check: 'bash/shellcheck', scope: '', status: 'on' },
        { check: 'bash/shfmt', scope: '', status: OFF_BY_IGNORE },
        { check: 'structure/shared-prefixes', scope: '', status: 'off (level)' },
    ]);
    expect([...result.selected, ...result.available].map(({ name }) => name).toSorted(compareText)).toStrictEqual(
        readConfigurations().keys().toArray().toSorted(compareText),
    );
    const defaults = await runGspot(sandbox.path, ['list', '--json']);
    expect(defaults.code, defaults.stdout + defaults.stderr).toBe(0);
    expect(JSON.parse(defaults.stdout)).toStrictEqual(result);
    const listedSettings = await runGspot(sandbox.path, ['list', 'settings', '--json']);
    expect(listedSettings.code, listedSettings.stdout + listedSettings.stderr).toBe(0);
    const rows = (JSON.parse(listedSettings.stdout) as SettingsListJson).settings;
    expect(rows.find((row) => row.key === 'level')?.value).toBe('basic');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('the check list reports the state in each scope', async () => {
    await using sandbox = await createGitSandbox({
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
    expect(checks.filter(({ check }) => check === 'bash/shfmt')).toStrictEqual([
        { check: 'bash/shfmt', scope: '', status: 'on' },
        { check: 'bash/shfmt', scope: 'api', status: OFF_BY_IGNORE },
        { check: 'bash/shfmt', scope: 'api/worker', status: OFF_BY_IGNORE },
    ]);
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('checks that run at the root appear once when selected in two child scopes', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            scopes: [
                { path: 'app', configurations: ['docker'] },
                { path: 'worker', configurations: ['docker'] },
            ],
        }),
        'app/Dockerfile': 'FROM scratch\n',
        'worker/Dockerfile': 'FROM scratch\n',
    });
    const listed = await runGspot(sandbox.path, ['list', '--json']);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const { selected } = JSON.parse(listed.stdout) as ConfigurationsListJson;
    const checks = selected.flatMap((configuration) => configuration.checks);
    expect(checks.filter(({ check }) => check === 'docker/dockerignore')).toStrictEqual([
        { check: 'docker/dockerignore', scope: '', status: 'on' },
    ]);
    expect(checks.filter(({ check }) => check === 'gspot/generated-files')).toStrictEqual([
        { check: 'gspot/generated-files', scope: '', status: 'on' },
    ]);
});

test('the settings list reports inherited values and their source scope', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': LIST_SCOPE_SETTINGS,
        'api/entry.sh': 'echo api\n',
        'api/worker/query.sql': 'SELECT 1;\n',
    });

    const before = await readTree(sandbox.path);
    const structured = await runGspot(sandbox.path, ['list', 'settings', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    const { settings } = JSON.parse(structured.stdout) as SettingsListJson;
    expect(settings.find((row) => row.key === 'test_files')?.reasonRequirement).toBeUndefined();
    expect(settings.find((row) => row.key === 'limits.file_lines')?.reasonRequirement).toBe('raising');
    expect(settings.find((row) => row.scope === 'api/worker' && row.key === 'limits.file_lines')).toMatchObject({
        value: 200,
        source: '[scope "api"]',
    });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('the text settings list shortens long values', async () => {
    await using sandbox = await createGitSandbox({
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
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('list without gspot.toml refuses the command and writes nothing', async () => {
    await using sandbox = await createGitSandbox({});
    await assertRefusalWithoutWrites(sandbox.path, ['list'], {
        error: 'settings',
        message: 'There is no gspot.toml here. Run gspot init to create one.',
    });
});

test('list shows each removed configuration with its scope and reason', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': [
            'configurations = ["bash"]',
            '[rule_files]',
            'enabled = false',
            '[removed_configurations]',
            'markdown = "The project keeps no Markdown files."',
            '[[scope]]',
            'path = "api"',
            '[scope.removed_configurations]',
            'bash = "The API keeps its scripts elsewhere."',
            '',
        ].join('\n'),
        'entry.sh': 'echo root\n',
        'api/entry.sh': 'echo api\n',
    });
    const structured = await runGspot(sandbox.path, ['list', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect((JSON.parse(structured.stdout) as ConfigurationsListJson).removed).toStrictEqual([
        { name: 'markdown', scope: '', reason: 'The project keeps no Markdown files.' },
        { name: 'bash', scope: 'api', reason: 'The API keeps its scripts elsewhere.' },
    ]);
});
