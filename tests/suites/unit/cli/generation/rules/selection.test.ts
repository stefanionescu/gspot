import { testdir } from 'testdirs';
import { openSession } from '#cli/planning/session.ts';
import { type Level } from '#cli/types/configurations.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import { test, expect, describe, beforeAll } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { RUNTIME_RULE_CASES } from '#tests/config/generation/rules.ts';
import { listSelectedConfigurations } from '#cli/configurations/select.ts';

async function generateRuleFiles(level: Level, files: Record<string, string>): Promise<Map<string, string>> {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'css', 'vitest', 'swift', 'bash', 'drizzle', 'openapi'], {
            rules: true,
            level,
        }),
        ...files,
    });

    const session = await openSession(sandbox.path);
    const output = generateFiles(session);
    return new Map(
        output.files
            .filter((file) => file.path.includes('/rules/') && file.path.endsWith('.md'))
            .map((file) => [file.path, file.content]),
    );
}

test.each(
    [
        { place: 'the root', scope: '' },
        { place: 'a scope', scope: 'app' },
    ].flatMap((place) => RUNTIME_RULE_CASES.map((row) => ({ ...row, ...place }))),
)('$name in $place selects the runtime rules $rules', async ({ scope, runtime, dependency, rules }) => {
    const prefix = scope === '' ? '' : scope + '/';
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(scope === '' ? ['javascript'] : [], {
            rules: true,
            level: 'all',
            scopes: scope === '' ? [] : [{ path: 'app', configurations: ['javascript'] }],
        }),
        [`${prefix}main.js`]: `#!/usr/bin/env ${runtime}\nconsole.log("ready");\n`,
        [`${prefix}package.json`]: JSON.stringify({
            engines: { [runtime]: '>=1' },
            dependencies: dependency === undefined ? {} : { [dependency]: '1.0.0' },
        }),
    });
    const session = await openSession(sandbox.path);
    const paths = selectRuleFiles(session).map((file) => file.path);
    expect(paths.filter((path) => /\/rules\/(?:DENO|NODE)\.md$/u.test(path))).toStrictEqual(
        rules.map((rule) => `language/javascript/rules/${rule}`),
    );
});

test('an always-selected configuration installs its rule file once', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([], { rules: true, level: 'all' }) });
    const session = await openSession(sandbox.path);
    const configurations = listSelectedConfigurations(session.scopes);
    const engineering = configurations.find((configuration) => configuration.name === 'engineering')!;
    for (const selected of [configurations, [...configurations, engineering]]) {
        const files = selectRuleFiles({ ...session, scopes: [{ ...session.scopes[0]!, configurations: selected }] });
        expect(files.filter((file) => file.path === 'general/engineering/rules/TALKING.md')).toHaveLength(1);
    }
});

describe('which rule files gspot writes', () => {
    let defaultLevel: ReadonlyMap<string, string>;

    let all: ReadonlyMap<string, string>;

    beforeAll(async () => {
        defaultLevel = await generateRuleFiles('basic', {});
        all = await generateRuleFiles('all', {});
    });

    test('a rule file whose sections are all for level all is written only at all', () => {
        expect(defaultLevel.has(getRuleFilePath('naming', 'NAMING.md'))).toBe(false);
        expect(all.has(getRuleFilePath('naming', 'NAMING.md'))).toBe(true);
        expect(defaultLevel.has(getRuleFilePath('engineering', 'WORKING.md'))).toBe(true);
    });

    test('rule files that need a file or a dependency are written only when it is there', async () => {
        const present = await generateRuleFiles('all', {
            'bunfig.toml': '[test]\nroot = "tests"\n',
            'package.json':
                '{"name":"example","devDependencies":{"tailwindcss":"4.1.0","@playwright/test":"1.50.0"}}\n',
        });
        for (const path of [
            getRuleFilePath('javascript', 'BUN.md'),
            getRuleFilePath('css', 'TAILWIND.md'),
            getRuleFilePath('javascript', 'PLAYWRIGHT.md'),
        ]) {
            expect(all.has(path)).toBe(false);
            expect(present.has(path)).toBe(true);
        }
    });

    test('Swift rule files need an import, not one in a comment or string', async () => {
        const absent = await generateRuleFiles('all', {
            'View.swift': '// import UIKit\nlet text = "import SwiftUI"\n',
        });
        const present = await generateRuleFiles('all', { 'View.swift': 'import SwiftUI\nimport class UIKit.UIView\n' });
        for (const path of [getRuleFilePath('swift', 'SWIFTUI.md'), getRuleFilePath('swift', 'UIKIT.md')]) {
            expect(absent.has(path)).toBe(false);
            expect(present.has(path)).toBe(true);
        }
    });
});

test.each(['deno.json', 'deno.jsonc'].flatMap((file) => ['', 'apps/api'].map((scope) => ({ file, scope }))))(
    'a Supabase layout with $file in scope $scope installs the Deno rule',
    async ({ file, scope }) => {
        const prefix = scope === '' ? '' : `${scope}/`;
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['supabase'], {
                rules: true,
                scopes: scope === '' ? [] : [{ path: scope }],
            }),
            [`${prefix}supabase/config.toml`]: 'project_id = "example"\n',
            [`${prefix}supabase/functions/submit-order/index.ts`]: 'export {};\n',
            [`${prefix}supabase/functions/submit-order/${file}`]: '{}\n',
        });
        const session = await openSession(sandbox.path);
        using _resources = session.resources;
        const files = generateFiles(session).files;
        expect(files.map(({ path }) => path)).toContain(getRuleFilePath('javascript', 'DENO.md'));
    },
);

test('YAML rules require a YAML file, including a nested workflow', async () => {
    const absent = await generateRuleFiles('all', {});
    const present = await generateRuleFiles('all', { '.github/workflows/ci.yaml': 'name: Checks\n' });
    expect(absent.has(getRuleFilePath('data-files', 'YAML.md'))).toBe(false);
    expect(present.has(getRuleFilePath('data-files', 'YAML.md'))).toBe(true);
});

test('the Neon Postgres driver selects the Drizzle rule file', async () => {
    const rules = await generateRuleFiles('all', {
        'package.json': '{"private":true,"dependencies":{"drizzle-orm":"1.0.0","@neondatabase/serverless":"1.0.0"}}',
    });
    expect(rules.has(getRuleFilePath('drizzle', 'DRIZZLE.md'))).toBe(true);
});

test('a Supabase project selects Deno rules without a Deno settings file', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['supabase'], { rules: true }),
        'supabase/config.toml': 'project_id = "example"\n',
    });
    const session = await openSession(sandbox.path);
    expect(selectRuleFiles(session).map(({ path }) => path)).toContain('language/javascript/rules/DENO.md');
});
