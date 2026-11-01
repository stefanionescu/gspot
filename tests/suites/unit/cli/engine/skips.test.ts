import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runChecks } from '#cli/engine/run.ts';
import { planChecks } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
import { listPackagePins } from '#cli/tools/pins.ts';
import { listSettingReaders } from '#cli/engine/skips.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { fakePlatform } from '#tests/setup/system/platform.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

import {
    VUE_TSC_SKIP,
    GENERATOR_LIMITS,
    NEXT_INTL_PROJECTS,
    BUILT_IN_LIMIT_CASES,
} from '#tests/config/engine/skips.ts';

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
            note: 'needs the setting xcode.allowed_entitlements',
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
            selected ? undefined : { cause: 'condition', note: 'Needs a project dependency: next-intl.' },
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
    ).toStrictEqual([...VUE_TSC_SKIP]);
});

test('a check whose tool has no Windows build is skipped on Windows', async () => {
    using mockResources = new DisposableStack();
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], { tables: '[security]\nrule_files = ["rules.yml"]\n' }),
        'rules.yml': 'rules: []\n',
        'source.py': 'PORT = 8080\n',
    });
    mockResources.use(fakePlatform('win32'));
    const session = await openSession(sandbox.path);
    expect(planChecks(session, { stage: 'all', only: ['security/semgrep'] }).map(({ skip }) => skip)).toStrictEqual([
        { cause: 'system', note: 'semgrep has no Windows build' },
    ]);
});

test.each([false, true])('Semgrep tools follow local rules at plan time (custom rules: %p)', async (hasRuleFiles) => {
    using _platform = fakePlatform('linux');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], {
            tables: hasRuleFiles ? '[security]\nrule_files = ["rules.yml"]\n' : '',
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
                  note: 'No selected configuration or security.rule_files supplies local rules.',
              },
    );
    expect(listPackagePins(session.toolConfigurations).python.some((pin) => pin.startsWith('semgrep=='))).toBe(
        hasRuleFiles,
    );
});

test('shipped Semgrep rules select its tool', async () => {
    using _platform = fakePlatform('linux');
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"name":"example","version":"1.0.0"}',
        'index.js': 'export const port = 8080;\n',
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

test('a check for other systems names the host in its skip note', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
        'main.swift': 'let value = 1\n',
    });
    using _platform = fakePlatform('linux');
    const planned = planChecks(await openSession(sandbox.path), { stage: 'all', only: ['swift/swiftlint-analyze'] });
    expect(planned.map(({ skip }) => skip)).toStrictEqual([
        { cause: 'system', note: 'runs on macos only; this is linux' },
    ]);
});

test('limit readers belong to the requested language', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'python', 'swift'], { level: 'all' }),
    });
    const session = await openSession(sandbox.path);
    expect(listSettingReaders(session.settings, session.scopes[0]!, 'limits.python.file_lines')).toStrictEqual([
        { check: 'structure/long-files', enabled: true },
    ]);
    expect(listSettingReaders(session.settings, session.scopes[0]!, 'limits.swift.file_lines')).toStrictEqual([
        { check: 'swift/swiftlint', enabled: true },
    ]);
});

test('limit readers report their enabled state and exact level note', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python'], { level: 'basic' }),
    });
    const session = await openSession(sandbox.path);
    expect(listSettingReaders(session.settings, session.scopes[0]!, 'limits.python.function_lines')).toStrictEqual([
        { check: 'python/function-size', enabled: false, note: 'off at level basic' },
    ]);
    expect(
        listSettingReaders({ ...session.settings, level: 'all' }, session.scopes[0]!, 'limits.python.function_lines'),
    ).toStrictEqual([{ check: 'python/function-size', enabled: true }]);
});

test.each(
    GENERATOR_LIMITS.flatMap(({ check, file, languages, limits }) =>
        languages.flatMap((language) => limits.map((limit) => ({ check, file, language, limit }))),
    ),
)(
    '$check writes the configured $limit limit of $language into its generated file',
    async ({ check, file, language, limit }) => {
        const value = limit === 'cognitive_complexity' ? '101' : '1001';
        const written =
            limit === 'trivial_function_statements'
                ? value
                : `{ value = ${value}, reason = "The generated limit must retain this distinctive value." }`;
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([language], {
                level: 'all',
                tables: `[structure]\nreexports = { value = "index-only", reason = "The index export limit needs an enabled index module." }\n[limits.${language}]\n${limit} = ${written}\n`,
            }),
        });
        const session = await openSession(sandbox.path);
        const generated = buildGeneratedFiles(session).files.find(({ path }) => path.endsWith(file));
        expect(generated, `${check} generates ${file}`).toBeDefined();
        expect(generated!.content).toMatch(new RegExp(String.raw`\b${value}\b`, 'u'));
    },
);

test.each([...BUILT_IN_LIMIT_CASES])('$check reads the $limit limit of $language', async (sample) => {
    const configuration = sample.language;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([configuration], {
            level: 'all',
            tables: `[limits.${sample.language}]\n${sample.limit} = 3\n`,
        }),
        [sample.file]: sample.source,
    });
    const findings = await runSandboxCheck(sandbox.path, sample.check);
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toContainEqual({ file: sample.file, rule: sample.rule });
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings([configuration], {
            level: 'all',
            tables: `[limits.${sample.language}]\n${sample.limit} = ${sample.limit === 'trivial_function_statements' ? '2' : '{ value = 1001, reason = "The sample falls below this configured threshold." }'}\n`,
        }),
    );
    expect(await runSandboxCheck(sandbox.path, sample.check)).toStrictEqual([]);
});

test('shared-prefixes reads its configured sibling limit', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[limits]\nshared_prefix_files = { value = 3, reason = "Three related files form the configured group." }\n',
        }),
        'order-first.js': 'export const first = 1;\n',
        'order-second.js': 'export const second = 2;\n',
        'order-third.js': 'export const third = 3;\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'structure/shared-prefixes')).toHaveLength(1);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[limits]\nshared_prefix_files = { value = 5, reason = "Five related files form the configured group." }\n',
        }),
    );
    expect(await runSandboxCheck(sandbox.path, 'structure/shared-prefixes')).toStrictEqual([]);
});
