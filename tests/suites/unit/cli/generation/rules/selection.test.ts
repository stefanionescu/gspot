import { testdir } from 'testdirs';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { type Level } from '#cli/types/configurations.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { test, expect, describe, beforeAll } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findRuleFileTarget } from '#tests/setup/cli/config-files.ts';
import { listSelectedConfigurations } from '#cli/configurations/select.ts';
import { RUNTIME_RULE_CASES, RULE_CONFIGURATIONS } from '#tests/config/generation/rules.ts';

async function generateRuleFiles(level: Level, files: Record<string, string>): Promise<Map<string, string>> {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([...RULE_CONFIGURATIONS], {
            rules: true,
            level,
        }),
        ...files,
    });

    const session = await openSession(sandbox.path);
    const output = generate(session);
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
    let recommended: ReadonlyMap<string, string>;

    let all: ReadonlyMap<string, string>;

    beforeAll(async () => {
        recommended = await generateRuleFiles('recommended', {});
        all = await generateRuleFiles('all', {});
    });

    test('a rule file whose sections are all for level all is written only at all', () => {
        expect(recommended.has(findRuleFileTarget('naming', 'NAMING.md'))).toBe(false);
        expect(all.has(findRuleFileTarget('naming', 'NAMING.md'))).toBe(true);
        expect(recommended.has(findRuleFileTarget('engineering', 'WORKING.md'))).toBe(true);
    });

    test('rule files that need a file or a dependency are written only when it is there', async () => {
        const present = await generateRuleFiles('all', {
            'bunfig.toml': '[test]\nroot = "tests"\n',
            'package.json':
                '{"name":"example","devDependencies":{"tailwindcss":"4.1.0","@playwright/test":"1.50.0"}}\n',
        });
        for (const path of [
            findRuleFileTarget('javascript', 'BUN.md'),
            findRuleFileTarget('css', 'TAILWIND.md'),
            findRuleFileTarget('javascript', 'PLAYWRIGHT.md'),
        ]) {
            expect(all.has(path)).toBe(false);
            expect(present.has(path)).toBe(true);
        }
    });

    test('Swift rule files need a real import, not one in a comment or string', async () => {
        const absent = await generateRuleFiles('all', {
            'View.swift': '// import UIKit\nlet text = "import SwiftUI"\n',
        });
        const present = await generateRuleFiles('all', { 'View.swift': 'import SwiftUI\nimport class UIKit.UIView\n' });
        for (const path of [findRuleFileTarget('swift', 'SWIFTUI.md'), findRuleFileTarget('swift', 'UIKIT.md')]) {
            expect(absent.has(path)).toBe(false);
            expect(present.has(path)).toBe(true);
        }
    });
});

test.each(['deno.json', 'deno.jsonc'].flatMap((file) => ['', 'apps/api'].map((scope) => ({ file, scope }))))(
    'a Supabase layout with $file in scope $scope installs the Deno rule named by SUPABASE.md',
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
        const files = generate(session).files;
        expect(files.map(({ path }) => path)).toContain(findRuleFileTarget('javascript', 'DENO.md'));
        const supabase = files.find(({ path }) => path === findRuleFileTarget('supabase', 'SUPABASE.md'));
        expect(supabase?.content).toContain('Edge Functions run on Deno; read DENO.md too.');
    },
);
