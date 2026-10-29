import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { planChecks } from '#cli/planning/checks.ts';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { isSettingEmpty } from '#cli/planning/skips.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { fakePlatform } from '#tests/setup/system/platform.ts';
import { listToolProjectPins } from '#cli/configurations/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
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
        const check = planned.find((each) => each.scope.path === scope)!;
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
    mockResources.use(fakePlatform('win32'));
    const session = await openSession(sandbox.path);
    expect(planChecks(session, { stage: 'all', only: ['security/semgrep'] }).map(({ skip }) => skip)).toStrictEqual([
        { cause: 'system', note: 'semgrep has no Windows build' },
    ]);
});

test.each([false, true])('Semgrep tools follow local rules at plan time (custom rules: %s)', async (hasRuleFiles) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], {
            tables: hasRuleFiles ? '[tools.semgrep]\nrule_files = ["rules.yml"]\n' : '',
        }),
        'rules.yml': 'rules: []\n',
        'source.py': 'PORT = 8080\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'push', only: ['security/semgrep'] });
    expect(planned[0]?.skip).toStrictEqual(
        hasRuleFiles
            ? undefined
            : {
                  cause: 'setting',
                  note: 'No selected configuration or tools.semgrep.rule_files supplies local rules.',
              },
    );
    expect(listToolProjectPins(session.toolConfigurations).python.some((pin) => pin.startsWith('semgrep=='))).toBe(
        hasRuleFiles,
    );
});

test('shipped Semgrep rules select its tool', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"name":"example","version":"1.0.0"}',
        'index.js': 'export const port = 8080;\n',
    });
    const session = await openSession(sandbox.path);
    expect(planChecks(session, { stage: 'push', only: ['security/semgrep'] })[0]?.skip).toBeUndefined();
    expect(listToolProjectPins(session.toolConfigurations).python.some((pin) => pin.startsWith('semgrep=='))).toBe(
        true,
    );
});

test('explicit registry packs select Semgrep without local rules', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], {
            tables: '[tools.semgrep]\nregistry_packs = ["p/owasp-top-ten"]\n',
        }),
        'source.py': 'PORT = 8080\n',
    });
    const session = await openSession(sandbox.path);
    expect(planChecks(session, { stage: 'manual', only: ['security/semgrep-registry'] })[0]?.skip).toBeUndefined();
    expect(listToolProjectPins(session.toolConfigurations).python.some((pin) => pin.startsWith('semgrep=='))).toBe(
        true,
    );
});

test('a setting table containing only empty lists is empty', () => {
    expect([isSettingEmpty({ paths: [], names: [] }), isSettingEmpty({ paths: [], names: ['entry'] })]).toStrictEqual([
        true,
        false,
    ]);
});

test('generated and vendored test files do not satisfy a source-tag condition', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift']),
        '.gitattributes': 'Generated.swift linguist-generated\nVendored.swift linguist-vendored\n',
        'Generated.swift': 'import XCTest\n',
        'Vendored.swift': 'import Testing\n',
        'Source.swift': 'let value = 1\n',
    });
    const session = await openSession(sandbox.path);
    expect(
        planChecks(session, { stage: 'push', only: ['swift/coverage'] }).map(({ check, skip }) => ({
            check: check.id,
            skip,
        })),
    ).toStrictEqual([
        {
            check: 'swift/coverage',
            skip: { cause: 'condition', note: 'Needs files marked swift-test or swift-test-target in this scope.' },
        },
    ]);
});

test('one matching dependency satisfies a condition listing alternatives', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['translations'], {
            tables: '[translations]\nmessages_folder = "messages"\n',
        }),
        'package.json': '{"dependencies":{"next-intl":"4.8.3"}}',
        'messages/en.json': '{"greeting":"Hello"}',
    });
    const session = await openSession(sandbox.path);
    const root = session.scopes[0]!;
    const configurations = root.configurations.map((configuration) =>
        configuration.name === 'translations'
            ? {
                  ...configuration,
                  checks: configuration.checks.map((check) => ({
                      ...check,
                      when: { ...check.when, dependencies: ['missing-library', 'next-intl'] },
                  })),
              }
            : configuration,
    );
    const inScope = { ...session, scopes: [{ ...root, configurations }] };
    expect(
        planChecks(inScope, { stage: 'push', only: ['translations/messages'] }).map(({ check, skip }) => ({
            check: check.id,
            skip,
        })),
    ).toStrictEqual([{ check: 'translations/messages', skip: undefined }]);
});

test('a check for other systems names the host in its skip note', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
        'main.swift': 'let value = 1\n',
    });
    using _platform = fakePlatform('linux');
    const planned = planChecks(await openSession(sandbox.path), { stage: 'all', only: ['swift/swiftlint-analyze'] });
    expect(planned.map(({ skip }) => skip)).toStrictEqual([
        { cause: 'system', note: 'runs on macos only; this is linux' },
    ]);
});
