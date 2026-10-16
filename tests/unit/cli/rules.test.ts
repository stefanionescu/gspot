import { join } from 'node:path';
import { format } from 'prettier';
import * as assets from '#cli/system/assets.ts';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import type { Level } from '#cli/types/configurations.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { RULES_DIRECTORY } from '#cli/config/system/locations.ts';
import { test, spyOn, expect, describe, beforeAll } from 'bun:test';
import { listSelectedManifests } from '#cli/configurations/select.ts';
import { selectRuleFiles, buildAgentsBlock } from '#cli/generation/rules.ts';
import { readManifests, listChecksById } from '#cli/configurations/manifests.ts';
import { DRIZZLE_DRIVERS, RUNTIME_RULE_CASES, RULE_CONFIGURATIONS } from '#tests/config/rules.ts';

{
    test('level filtering respects fenced examples, nested sections, and the next heading of the same depth', async () => {
        const before = '# Guide\n\n## Required\n\n```md\n## Example\n<!-- level: all -->\n```\n\n';
        const omitted =
            '## Convention\n<!-- level: all -->\n\nContent.\n\n### Detail\n<!-- level: all -->\n\n```md\n## Not a boundary\n```\n\n';
        const after = '## Safety\n\nKeep this requirement.\n';
        const text = before + omitted + after;
        await using sandbox = await testdir({
            'gspot.toml': settingsText(['bash'], { rules: true }),
            'rules/GUIDE.md': text,
        });
        const session = await openSession(sandbox.path);
        const manifest = {
            ...readManifests(createReadCache(process.cwd())).get('bash')!,
            dir: sandbox.path.replaceAll('\\', '/'),
            rules: {},
        };
        using _list = spyOn(assets, 'listAssets').mockReturnValue([`${manifest.dir}/rules/GUIDE.md`]);
        using _read = spyOn(assets, 'readAsset').mockImplementation((path) => readFileSync(path, 'utf8'));
        const recommended = selectRuleFiles(
            session.settingsFile.settings.rules,
            [manifest],
            session.repository,
            'recommended',
            session.packageManifests,
        );
        expect(recommended.map(({ content }) => content)).toStrictEqual([before + after]);
        const all = selectRuleFiles(
            session.settingsFile.settings.rules,
            [manifest],
            session.repository,
            'all',
            session.packageManifests,
        );
        expect(all.map(({ content }) => content)).toStrictEqual([text]);
        writeFileSync(join(sandbox.path, 'rules/GUIDE.md'), before + after);
        expect(
            selectRuleFiles(
                session.settingsFile.settings.rules,
                [manifest],
                session.repository,
                'recommended',
                session.packageManifests,
            ).map(({ content }) => content),
        ).toStrictEqual([before + after]);
    });

    test.each(['', 'app'].flatMap((scope) => RUNTIME_RULE_CASES.map((row) => ({ ...row, scope }))))(
        '$runtime rules with $dependency in $scope select DENO.md and NODE.md',
        async ({ scope, runtime, dependency, hasNode }) => {
            const prefix = scope === '' ? '' : scope + '/';
            await using sandbox = await testdir({
                'gspot.toml': settingsText(scope === '' ? ['javascript'] : [], {
                    rules: true,
                    level: 'all',
                    tables: scope === '' ? '' : '[[scope]]\npath = "app"\nconfigurations = ["javascript"]\n',
                }),
                [`${prefix}main.js`]: `#!/usr/bin/env ${runtime}\nconsole.log("ready");\n`,
                [`${prefix}package.json`]: JSON.stringify({
                    engines: { [runtime]: '>=1' },
                    dependencies: dependency === undefined ? {} : { [dependency]: '1.0.0' },
                }),
            });
            const session = await openSession(sandbox.path);
            const files = selectRuleFiles(
                session.settingsFile.settings.rules,
                listSelectedManifests(session.scopes),
                session.repository,
                'all',
                session.packageManifests,
            );
            const paths = files.map((file) => file.path);
            expect(paths.includes('language/javascript/DENO.md')).toBe(runtime === 'deno');
            expect(paths.includes('language/javascript/NODE.md')).toBe(hasNode);
            expect(paths).not.toContain('platform/supabase/DENO.md');
            expect(paths).toContain('general/engineering/agent/TALKING.md');
        },
    );

    test('an always-selected configuration installs its rule file once', async () => {
        await using sandbox = await testdir({ 'gspot.toml': settingsText([], { rules: true, level: 'all' }) });
        const session = await openSession(sandbox.path);
        const engineering = listSelectedManifests(session.scopes).find(
            (manifest) => manifest.configuration.name === 'engineering',
        )!;
        const manifests = listSelectedManifests(session.scopes);
        for (const selected of [manifests, [...manifests, engineering]]) {
            const files = selectRuleFiles(
                session.settingsFile.settings.rules,
                selected,
                session.repository,
                'all',
                session.packageManifests,
            );
            expect(files.filter((file) => file.path === 'general/engineering/agent/TALKING.md')).toHaveLength(1);
        }
    });
}
{
    async function blockFor(root: string): Promise<string> {
        const session = await openSession(root);
        const { rules, level } = session.settingsFile.settings;
        const selected = listSelectedManifests(session.scopes);
        const generated = emitAll(session);
        return buildAgentsBlock({
            generatedPaths: [...generated.files, ...generated.fileEdits]
                .map(({ path }) => path)
                .filter((path) => !path.startsWith('.gspot/')),
            level,
            files: selectRuleFiles(rules, selected, session.repository, level, session.packageManifests),
            startCommand: session.startRunner.command,
            hasChecks: listChecksById(selected).size > 0,
        });
    }

    describe('the managed block', () => {
        test('with no configurations the block still lists the general rules and the check command', async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'gspot.toml': settingsText([], { rules: true }) });
            const block = await blockFor(sandbox.path);
            expect(block).toContain('agent/WORKING.md');
            expect(block).toContain('Run `mise exec -- gspot check --staged` before you commit');
            expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
        });

        test('with a check selected the block names the command, and an excluded file leaves the index', async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'gspot.toml': settingsText(['spelling'], {
                    rules: true,
                    tables: '\n[rules]\nexclude = [".gspot/rules/general/engineering/code/ACCESSIBILITY.md"]\n',
                }),
            });
            const block = await blockFor(sandbox.path);
            expect(block).toContain('Run `mise exec -- gspot check --staged` before you commit');
            expect(block).not.toContain('ACCESSIBILITY.md');
            expect(block).toContain('code/TESTING.md');
            expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
        });
    });
}
{
    async function writtenRuleFiles(level: Level, files: Record<string, string>): Promise<Map<string, string>> {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText([...RULE_CONFIGURATIONS], {
                rules: true,
                level: level,
            }),
            ...files,
        });
        const session = await openSession(sandbox.path);
        const output = emitAll(session);
        return new Map(output.files.filter((file) => file.kind === 'rules').map((file) => [file.path, file.content]));
    }

    let recommended: ReadonlyMap<string, string>;

    let all: ReadonlyMap<string, string>;

    beforeAll(async () => {
        recommended = await writtenRuleFiles('recommended', {});
        all = await writtenRuleFiles('all', {});
    });

    test('a rule file whose sections are all for level all is written only at all', () => {
        for (const path of ['general/naming/NAMING.md', 'language/typescript/NAMING.md', 'language/bash/NAMING.md']) {
            expect(recommended.has(`${RULES_DIRECTORY}/${path}`)).toBe(false);
            expect(all.has(`${RULES_DIRECTORY}/${path}`)).toBe(true);
        }
        expect(recommended.has(`${RULES_DIRECTORY}/general/engineering/agent/WORKING.md`)).toBe(true);
    });

    test('rule files that need a file or a dependency are written only when it is there', async () => {
        const present = await writtenRuleFiles('all', {
            'bunfig.toml': '[test]\nroot = "tests"\n',
            'package.json':
                '{"name":"example","devDependencies":{"tailwindcss":"4.1.0","@playwright/test":"1.50.0"}}\n',
        });
        for (const path of [
            'language/javascript/BUN.md',
            'language/css/TAILWIND.md',
            'language/javascript/PLAYWRIGHT.md',
        ]) {
            expect(all.has(`${RULES_DIRECTORY}/${path}`)).toBe(false);
            expect(present.has(`${RULES_DIRECTORY}/${path}`)).toBe(true);
        }
    });

    test('Swift rule files need a real import, not one in a comment or string', async () => {
        const absent = await writtenRuleFiles('all', {
            'View.swift': '// import UIKit\nlet text = "import SwiftUI"\n',
        });
        const present = await writtenRuleFiles('all', { 'View.swift': 'import SwiftUI\nimport class UIKit.UIView\n' });
        for (const path of ['language/swift/SWIFTUI.md', 'language/swift/UIKIT.md']) {
            expect(absent.has(`${RULES_DIRECTORY}/${path}`)).toBe(false);
            expect(present.has(`${RULES_DIRECTORY}/${path}`)).toBe(true);
        }
    });

    test.each([...DRIZZLE_DRIVERS])(
        'the Drizzle rules are written only for a PostgreSQL driver: $driver',
        async ({ driver, postgres }) => {
            const guides = await writtenRuleFiles('all', {
                'package.json': JSON.stringify({ dependencies: { 'drizzle-orm': '0.45.1', [driver]: '1.0.0' } }),
            });
            expect(guides.has(`${RULES_DIRECTORY}/library/drizzle/DRIZZLE.md`)).toBe(postgres);
        },
    );
}

test('a React dependency selects COMPONENTS.md', async () => {
    await using sandbox = await testdir({
        'gspot.toml': 'configurations = ["javascript"]\n',
        'package.json': '{"dependencies":{"react":"19.2.0"}}',
    });
    const session = await openSession(sandbox.path);
    expect(
        selectRuleFiles(
            session.settingsFile.settings.rules,
            listSelectedManifests(session.scopes),
            session.repository,
            session.settingsFile.settings.level,
            session.packageManifests,
        ).map(({ path }) => path),
    ).toContain('language/javascript/COMPONENTS.md');
});
