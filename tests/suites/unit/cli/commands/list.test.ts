import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { compareText } from '#cli/system/text.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGspot, assertRefusalWithoutWrites } from '#tests/setup/cli/commands.ts';
import type { SettingsListJson, ConfigurationsListJson } from '#cli/types/commands/list.ts';

import {
    OFF_BY_IGNORE,
    LIST_SCOPE_ROWS,
    LIST_SCOPE_SETTINGS,
    SHFMT_IGNORE_SETTINGS,
} from '#tests/config/commands/list.ts';

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
    expect(checks.filter(({ name }) => named.has(name))).toStrictEqual([
        { name: 'bash/shellcheck', scope: '', state: 'on' },
        { name: 'bash/shfmt', scope: '', state: OFF_BY_IGNORE },
        { name: 'structure/shared-prefixes', scope: '', state: 'off (level)' },
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

test('the text configuration list shows the selected names of the JSON list', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });

    const before = await readTree(sandbox.path);
    const structured = await runGspot(sandbox.path, ['list', 'configurations', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(0);
    expect(structured.stderr).toBe('');
    const { selected, available } = JSON.parse(structured.stdout) as ConfigurationsListJson;
    const human = await runGspot(sandbox.path, ['list', 'configurations']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stderr).toBe('');
    const [selectedText = '', availableText = ''] = human.stdout.split('\n\navailable\n');
    expect(selectedText.split('\n').filter((line) => /^ {2}\S+$/u.test(line))).toStrictEqual(
        selected.map(({ name }) => `  ${name}`),
    );
    expect(selectedText.split('\n')).toContain('    bash/shellcheck  root: on');
    expect(availableText.split('\n').filter((line) => line !== '')).toStrictEqual(
        available.map(({ name, description }) => `  ${name}  ${description}`),
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('the text check list puts the states of all scopes in one row', async () => {
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
    expect(checks.filter((check) => check.name === 'bash/shfmt')).toStrictEqual([
        { name: 'bash/shfmt', scope: '', state: 'on' },
        { name: 'bash/shfmt', scope: 'api', state: OFF_BY_IGNORE },
        { name: 'bash/shfmt', scope: 'api/worker', state: OFF_BY_IGNORE },
    ]);
    const human = await runGspot(sandbox.path, ['list']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stderr).toBe('');
    expect(
        human.stdout
            .split('\n')
            .filter((line) => /^ {4}(?:bash\/shellcheck|bash\/shfmt|gspot\/generated-files) /u.test(line)),
    ).toStrictEqual([
        '    bash/shellcheck  root: on, api: on, api/worker: on',
        '    bash/shfmt  root: on, api: off (ignore), api/worker: off (ignore)',
        '    gspot/generated-files  root: on',
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
    expect(checks.filter(({ name }) => name === 'docker/dockerignore')).toStrictEqual([
        { name: 'docker/dockerignore', scope: '', state: 'on' },
    ]);
    expect(checks.filter(({ name }) => name === 'gspot/generated-files')).toStrictEqual([
        { name: 'gspot/generated-files', scope: '', state: 'on' },
    ]);
    const human = await runGspot(sandbox.path, ['list']);
    expect(human.stdout).toContain('    docker/dockerignore  root: on\n');
    expect(human.stdout).toContain('    gspot/generated-files  root: on\n');
});

test('the text settings list shows scope values while JSON keeps inherited values', async () => {
    await using sandbox = await createGitSandbox({
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
    expect(settings.find((row) => row.key === 'test_files')?.reason_when).toBeUndefined();
    expect(settings.find((row) => row.key === 'limits.file_lines')?.reason_when).toBe('raising');
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
            '[rules]',
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
    const human = await runGspot(sandbox.path, ['list']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stdout).toContain(
        '\nremoved\n  markdown  The project keeps no Markdown files.\n  bash  [scope api]  The API keeps its scripts elsewhere.\n\navailable\n',
    );
});
