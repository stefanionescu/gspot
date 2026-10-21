import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/builders.ts';
import { NEXT_INTL_PROJECTS } from '#tests/data/runs/plan.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { simulateOperatingSystem } from '#tests/setup/system.ts';

test('a check whose required setting is missing is skipped with a note naming the setting', async () => {
    const settings = buildSandboxSettings(['xcode'], { level: 'all' });
    await using sandbox = await testdir({
        'gspot.toml': settings,
        'App.entitlements':
            '<?xml version="1.0"?><plist><dict><key>aps-environment</key><string>development</string></dict></plist>',
    });

    const options = buildRunOptions({ only: ['xcode/entitlements'] });
    const session = await openSession(sandbox.path);
    const result = await runChecks(session, options);
    expect(result.report.checks).toMatchObject([
        {
            check: 'xcode/entitlements',
            status: 'skipped',
            note: expect.stringContaining('xcode.allowed_entitlements') as string,
        },
    ]);
});

test('a commits check outside Git is skipped because there is no history to read', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['commits'], { level: 'all' }),
        'source.py': 'PORT = 8080\n',
    });
    const planned = planChecks(await openSession(sandbox.path), {
        stage: 'push',
        only: ['commits/commitlint-pushed'],
    });
    expect(planned.map((check) => check.skip)).toStrictEqual([
        { cause: 'condition', note: 'This folder is not a Git repository, so the check has no history to read.' },
    ]);
});

test.each([...NEXT_INTL_PROJECTS])('next-intl dependency condition: $name', async ({ scope, files, selected }) => {
    await using sandbox = await testdir({
        ...files,
        'gspot.toml': buildSandboxSettings(['translations'], {
            tables: '[translations]\nmessages_folder = "messages"\n',
            scopes: [{ path: 'app' }, { path: 'app/deep' }, { path: 'sibling' }],
        }),
        'source.ts': 'export {};\n',
        'app/source.ts': 'export {};\n',
        'app/deep/source.ts': 'export {};\n',
        'sibling/source.ts': 'export {};\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'push', only: ['translations/messages'] });
    const check = planned.find((entry) => entry.selection.scope.path === scope)!;
    expect(check.skip).toStrictEqual(
        selected ? undefined : { cause: 'condition', note: 'Needs a project dependency: next-intl.' },
    );
});

test('vue/vue-tsc without the typescript configuration is skipped with its condition', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'vue']),
        'src/App.vue': '<template><p>App</p></template>',
    });
    expect(
        planChecks(await openSession(sandbox.path), { stage: 'all', only: ['vue/vue-tsc'] }).map(({ check, skip }) => ({
            check: check.name,
            skip,
        })),
    ).toStrictEqual([
        {
            check: 'vue/vue-tsc',
            skip: { cause: 'condition', note: 'Needs the typescript configuration, which this scope does not select.' },
        },
    ]);
});

test('Prettier filters its files through a linked ignore file inside the repository', async () => {
    await using sandbox = await testdir();
    const ignored = 'ignored.md\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['markdown']),
        'settings/format.ignore': ignored,
        '.gspot/configurations/.keep': '',
        'ignored.md': '# Ignored\n',
        'kept.md': '# Kept\n',
    });
    await symlink('settings/format.ignore', join(sandbox.path, '.prettierignore'));
    const session = await openSession(sandbox.path);
    const plans = planChecks(session, { stage: 'commit', only: ['format/prettier'] });
    expect(plans[0]!.files.map((file) => file.path)).toContain('kept.md');
    expect(plans[0]!.files.map((file) => file.path)).not.toContain('ignored.md');
});

test('a check whose tool has no Windows build is skipped on Windows', async () => {
    using mockResources = new DisposableStack();
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], { tables: '[tools.semgrep]\nrule_files = ["rules.yml"]\n' }),
        'rules.yml': 'rules: []\n',
        'source.py': 'PORT = 8080\n',
    });
    mockResources.use(simulateOperatingSystem('win32'));
    const session = await openSession(sandbox.path);
    expect(planChecks(session, { stage: 'all', only: ['security/semgrep'] })).toMatchObject([
        { check: { name: 'security/semgrep' }, skip: { cause: 'system' } },
    ]);
});
