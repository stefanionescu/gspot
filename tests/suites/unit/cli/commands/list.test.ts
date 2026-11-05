import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { readConfigurations } from '#cli/manifests/read.ts';
import { configurationsListOutputSchema, settingsListOutputSchema } from '#cli/schemas/commands.ts';
import { compareText } from '#cli/system/text.ts';
import { LIST_SCOPE_SETTINGS, SHFMT_IGNORE_SETTINGS } from '#tests/config/commands/reports.ts';
import { assertRefusalWithoutWrites, runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readTree } from '#tests/setup/system/files.ts';

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
    const result = configurationsListOutputSchema.parse(JSON.parse(listed.stdout));
    const checks = result.selected.flatMap((configuration) => configuration.checks);
    const named = new Set(['bash/shellcheck', 'bash/shfmt', 'structure/shared-prefixes']);
    expect(checks.filter(({ check }) => named.has(check))).toStrictEqual([
        { check: 'bash/shellcheck', scope: '', status: 'on' },
        { check: 'bash/shfmt', scope: '', status: 'skipped', cause: 'ignore' },
        { check: 'structure/shared-prefixes', scope: '', status: 'skipped', cause: 'level' },
    ]);
    expect([...result.selected, ...result.available].map(({ name }) => name).toSorted(compareText)).toStrictEqual(
        readConfigurations().keys().toArray().toSorted(compareText),
    );
    const defaults = await runGspot(sandbox.path, ['list', '--json']);
    expect(defaults.code, defaults.stdout + defaults.stderr).toBe(0);
    expect(JSON.parse(defaults.stdout)).toStrictEqual(result);
    const listedSettings = await runGspot(sandbox.path, ['list', 'settings', '--json']);
    expect(listedSettings.code, listedSettings.stdout + listedSettings.stderr).toBe(0);
    const rows = settingsListOutputSchema.parse(JSON.parse(listedSettings.stdout)).settings;
    expect(rows.find((row) => row.setting === 'level')?.value).toBe('basic');
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
    const { selected } = configurationsListOutputSchema.parse(JSON.parse(listed.stdout));
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
    const { settings } = settingsListOutputSchema.parse(JSON.parse(structured.stdout));
    expect(settings.find((row) => row.setting === 'test_files')?.reasonFor).toBeUndefined();
    expect(settings.find((row) => row.setting === 'limits.max_file_lines')?.reasonFor).toBe('raising');
    expect(settings.find((row) => row.scope === 'api/worker' && row.setting === 'limits.max_file_lines')).toMatchObject(
        {
            value: 200,
            source: { kind: 'scope', name: 'api' },
        },
    );
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('the settings list leaves out a naming category that gspot set refuses', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['typescript']) });
    const { stdout } = await runGspot(sandbox.path, ['list', 'settings']);
    expect(stdout).toContain('naming.typescript.types.cases');
    expect(stdout).not.toContain('naming.typescript.classes.cases');
});

test('the text lists group equal scope states on one line', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], {
            tables: '[[ignore]]\ncheck = "bash/shfmt"\npaths = ["api/**"]\nreason = "Review scoped syntax separately."\n',
            scopes: [{ path: 'api' }, { path: 'api/worker' }, { path: 'web' }],
        }),
        'entry.sh': 'echo root\n',
        'api/entry.sh': 'echo api\n',
        'api/worker/entry.sh': 'echo worker\n',
        'web/entry.sh': 'echo web\n',
    });
    const checks = await runGspot(sandbox.path, ['list']);
    expect(checks.code, checks.stdout + checks.stderr).toBe(0);
    expect(checks.stdout).toContain('bash/shellcheck  on in . and 3 scopes\n');
    expect(checks.stdout).toContain('bash/shfmt  on in ., web; skipped (ignore) in api, api/worker\n');
    const settings = await runGspot(sandbox.path, ['list', 'settings']);
    expect(settings.stdout).toMatch(/^limits\.max_file_lines +\d+ .* in \. and 3 scopes$/mu);
});

test('list without gspot.toml refuses the command and writes nothing', async () => {
    await using sandbox = await createGitSandbox({});
    await assertRefusalWithoutWrites(sandbox.path, ['list'], 'settings');
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
    expect(configurationsListOutputSchema.parse(JSON.parse(structured.stdout)).removed).toStrictEqual([
        { name: 'markdown', scope: '', reason: 'The project keeps no Markdown files.' },
        { name: 'bash', scope: 'api', reason: 'The API keeps its scripts elsewhere.' },
    ]);
});
