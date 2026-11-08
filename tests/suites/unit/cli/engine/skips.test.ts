import { expect, test } from 'bun:test';

import { planChecks } from '#cli/engine/plan.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { listSettingReaders } from '#cli/engine/skips.ts';
import { listPackagePins } from '#cli/tools/pins.ts';
import { NEXT_INTL_PROJECTS } from '#tests/config/engine/skips.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { fakePlatform, isWindows } from '#tests/setup/system/platform.ts';

test('a check whose required setting is missing is skipped with a note naming the setting', async () => {
    const settings = buildSandboxSettings(['xcode'], { level: 'all' });
    await using sandbox = await createGitSandbox({
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

test.each([...NEXT_INTL_PROJECTS])(
    'translations/messages runs only where the project depends on next-intl: $name (selected: $selected)',
    async ({ scope, files, selected }) => {
        await using sandbox = await createGitSandbox({
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
            selected ? undefined : { cause: 'condition', note: expect.stringContaining('next-intl') as string },
        );
    },
);

test('vue/vue-tsc without the typescript configuration is skipped with its condition', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'vue']),
        'src/App.vue': '<template><p>App</p></template>',
    });
    expect(
        planChecks(await openSession(sandbox.path), { stage: 'all', only: ['vue/vue-tsc'] }).map(({ check, skip }) => ({
            check: check.id,
            skip,
        })),
    ).toStrictEqual([
        { check: 'vue/vue-tsc', skip: { cause: 'condition', note: expect.stringContaining('typescript') as string } },
    ]);
});

test.skipIf(!isWindows)('a check whose tool has no Windows build is skipped on Windows', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], { tables: '[security]\nsemgrep_rules = ["rules.yml"]\n' }),
        'rules.yml': 'rules: []\n',
        'source.py': 'PORT = 8080\n',
    });
    const session = await openSession(sandbox.path);
    expect(planChecks(session, { stage: 'all', only: ['security/semgrep'] }).map(({ skip }) => skip)).toStrictEqual([
        { cause: 'system', note: expect.stringContaining('semgrep') as string },
    ]);
});

test.each([false, true])('Semgrep tools follow local rules at plan time (custom rules: %p)', async (hasRuleFiles) => {
    using _platform = fakePlatform('linux');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], {
            tables: hasRuleFiles ? '[security]\nsemgrep_rules = ["rules.yml"]\n' : '',
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
                  note: expect.stringContaining('security.semgrep_rules') as string,
              },
    );
    expect(listPackagePins(session.toolConfigurations).python.some((pin) => pin.startsWith('semgrep=='))).toBe(
        hasRuleFiles,
    );
});

test('shipped Semgrep rules select its tool', async () => {
    using _platform = fakePlatform('linux');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['fastapi']),
        'pyproject.toml': '[project]\nname = "example"\nversion = "1.0.0"\ndependencies = ["fastapi"]\n',
        'source.py': 'PORT = 8080\n',
    });
    const session = await openSession(sandbox.path);
    expect(planChecks(session, { stage: 'push', only: ['security/semgrep'] })[0]?.skip).toBeUndefined();
    expect(listPackagePins(session.toolConfigurations).python.some((pin) => pin.startsWith('semgrep=='))).toBe(true);
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
        planChecks(session, { stage: 'push', only: ['swift/tests'] }).map(({ check, skip }) => ({
            check: check.id,
            skip,
        })),
    ).toStrictEqual([
        {
            check: 'swift/tests',
            skip: { cause: 'condition', note: expect.stringContaining('swift-test') as string },
        },
    ]);
});

test('pytest/tests skips a scope that holds no test file', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python', 'pytest'], { scopes: [{ path: 'docs' }, { path: 'app' }] }),
        'docs/conf.py': 'project = "example"\n',
        'app/main.py': 'VALUE = 1\n',
        'app/tests/test_main.py': 'def test_value():\n    assert True\n',
    });
    const planned = planChecks(await openSession(sandbox.path), { stage: 'push', only: ['pytest/tests'] });
    expect(planned.map(({ scope, skip }) => ({ scope: scope.path, skip }))).toStrictEqual([
        { scope: '', skip: undefined },
        { scope: 'app', skip: undefined },
        {
            scope: 'docs',
            skip: { cause: 'condition', note: expect.stringContaining('conftest.py') as string },
        },
    ]);
});

test('a check for other systems names the host in its skip note', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
        'main.swift': 'let value = 1\n',
    });
    using _platform = fakePlatform('linux');
    const planned = planChecks(await openSession(sandbox.path), { stage: 'all', only: ['swift/swiftlint-analyze'] });
    expect(planned.map(({ skip }) => skip)).toStrictEqual([
        { cause: 'system', note: expect.stringMatching(/\bmacos\b.+\blinux\b/u) as string },
    ]);
});

test('limit readers belong to the requested language', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'python', 'swift'], { level: 'all' }),
    });
    const session = await openSession(sandbox.path);
    expect(listSettingReaders(session.settings, session.scopes[0]!, 'limits.python.max_file_lines')).toStrictEqual([
        { check: 'structure/long-files', enabled: true },
    ]);
    expect(listSettingReaders(session.settings, session.scopes[0]!, 'limits.swift.max_file_lines')).toStrictEqual([
        { check: 'swift/swiftlint', enabled: true },
    ]);
});

test('limit readers report their enabled state and exact level note', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], { level: 'basic' }),
    });
    const session = await openSession(sandbox.path);
    expect(listSettingReaders(session.settings, session.scopes[0]!, 'limits.python.max_function_lines')).toStrictEqual([
        { check: 'python/function-size', enabled: false, note: expect.stringContaining('basic') as string },
    ]);
    expect(
        listSettingReaders(
            { ...session.settings, level: 'all' },
            session.scopes[0]!,
            'limits.python.max_function_lines',
        ),
    ).toStrictEqual([{ check: 'python/function-size', enabled: true }]);
});
