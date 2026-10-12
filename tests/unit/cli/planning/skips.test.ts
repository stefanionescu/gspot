import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { planRun } from '#cli/planning/checks.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { textContaining } from '#tests/setup/matchers.ts';
import { buildRunOptions } from '#tests/setup/run-gspot.ts';
import { NEXT_INTL_PROJECTS } from '#tests/config/planning.ts';
import { useOperatingSystem } from '#tests/setup/operating-systems.ts';

test('a check whose required setting is missing is skipped with a note naming the setting', async () => {
    const settings = settingsText(['xcode'], { level: 'all' });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'App.entitlements':
            '<?xml version="1.0"?><plist><dict><key>aps-environment</key><string>development</string></dict></plist>',
    });
    const options = buildRunOptions({ only: ['xcode/entitlements'] });
    const session = await openSession(sandbox.path);
    const outcome = await executeRun(session, options);
    expect(outcome.report.checks).toMatchObject([
        {
            check: 'xcode/entitlements',
            status: 'skipped',
            note: textContaining('xcode.allowed_entitlements'),
        },
    ]);
});

test('a commits check outside Git is skipped because there is no history to read', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['commits'], { level: 'all' }),
        'source.py': 'PORT = 8080\n',
    });
    const planned = planRun(await openSession(sandbox.path), {
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
        'gspot.toml': settingsText(['translations'], {
            tables: `[translations]
messages_folder = "messages"
[[scope]]
path = "app"
[[scope]]
path = "app/deep"
[[scope]]
path = "sibling"
`,
        }),
        'source.ts': 'export {};\n',
        'app/source.ts': 'export {};\n',
        'app/deep/source.ts': 'export {};\n',
        'sibling/source.ts': 'export {};\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planRun(session, { stage: 'push', only: ['translations/messages'] });
    const check = planned.find((entry) => entry.scope.scope.path === scope)!;
    expect(check.skip).toStrictEqual(
        selected ? undefined : { cause: 'condition', note: 'Needs a project dependency: next-intl.' },
    );
});

test('vue/vue-tsc without the typescript configuration is skipped with its condition', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['javascript', 'vue']),
        'src/App.vue': '<template><p>App</p></template>',
    });
    expect(
        planRun(await openSession(sandbox.path), { stage: 'all', only: ['vue/vue-tsc'] }).map(({ check, skip }) => ({
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

test('security/codeql waits for tools.codeql.languages while security/semgrep-registry runs', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['security']),
        'source.js': 'export const port = 8080;\n',
    });
    const checks = planRun(await openSession(sandbox.path), {
        stage: 'all',
        includeUnsupported: true,
        only: ['security/semgrep-registry', 'security/codeql'],
    });
    expect(
        checks.map((check) => ({ check: check.check.name, cause: check.skip?.cause, note: check.skip?.note })),
    ).toStrictEqual([
        {
            check: 'security/semgrep-registry',
            cause: undefined,
            note: undefined,
        },
        {
            check: 'security/codeql',
            cause: 'setting',
            note: 'requires project setting tools.codeql.languages',
        },
    ]);
});

test('Prettier filters its files through a linked ignore file inside the repository', async () => {
    await using sandbox = await testdir();
    const ignored = 'ignored.md\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['markdown']),
        'settings/format.ignore': ignored,
        '.gspot/config/.keep': '',
        'ignored.md': '# Ignored\n',
        'kept.md': '# Kept\n',
    });
    await symlink('settings/format.ignore', join(sandbox.path, '.prettierignore'));
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', only: ['format/prettier'] });
    expect(plans[0]!.files.map((file) => file.path)).toContain('kept.md');
    expect(plans[0]!.files.map((file) => file.path)).not.toContain('ignored.md');
});

test('a check whose tool has no Windows build is skipped on Windows', async () => {
    using mockResources = new DisposableStack();
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['python'], { tables: '[tools.semgrep]\nrule_files = ["rules.yml"]\n' }),
        'rules.yml': 'rules: []\n',
        'source.py': 'PORT = 8080\n',
    });
    mockResources.use(useOperatingSystem('win32'));
    const session = await openSession(sandbox.path);
    expect(planRun(session, { stage: 'all', only: ['security/semgrep'] })).toMatchObject([
        { check: { name: 'security/semgrep' }, skip: { cause: 'platform' } },
    ]);
});
