import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { planChecks } from '#cli/planning/checks.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { simulateOperatingSystem } from '#tests/setup/system/platform.ts';
import { VUE_TSC_SKIP, NEXT_INTL_PROJECTS } from '#tests/config/planning/skips.ts';

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
            note: 'needs the setting xcode.allowed_entitlements',
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

test.each([...NEXT_INTL_PROJECTS])(
    'translations/messages runs only where the project depends on next-intl: $name (selected: $selected)',
    async ({ scope, files, selected }) => {
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
        const check = planned.find((each) => each.scope.folder.path === scope)!;
        expect(check.skip).toStrictEqual(
            selected ? undefined : { cause: 'condition', note: 'Needs a project dependency: next-intl.' },
        );
    },
);

test('vue/vue-tsc without the typescript configuration is skipped with its condition', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'vue']),
        'src/App.vue': '<template><p>App</p></template>',
    });
    expect(
        planChecks(await openSession(sandbox.path), { stage: 'all', only: ['vue/vue-tsc'] }).map(({ check, skip }) => ({
            check: check.id,
            skip,
        })),
    ).toStrictEqual([...VUE_TSC_SKIP]);
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
        { check: { id: 'security/semgrep' }, skip: { cause: 'system' } },
    ]);
});
