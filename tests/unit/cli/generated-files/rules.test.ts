import { join } from 'node:path';
import { format } from 'prettier';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import * as assets from '#cli/system/assets.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { generate } from '#cli/generation/generate.ts';
import { type Level } from '#cli/types/configurations.ts';
import { RULES_PATH } from '#cli/config/system/locations.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { test, spyOn, expect, describe, beforeAll } from 'bun:test';
import { listSelectedManifests } from '#cli/configurations/select.ts';
import { selectRuleFiles, buildAgentsBlock } from '#cli/generation/rules.ts';
import { readManifests, listChecksById } from '#cli/configurations/manifests.ts';

import {
    OWN_CLAUDE_TEXT,
    DRIZZLE_DRIVERS,
    RUNTIME_RULE_CASES,
    RULE_CONFIGURATIONS,
    EARLIER_CLAUDE_BLOCK,
} from '#tests/data/rules.ts';

async function generateRuleFiles(level: Level, files: Record<string, string>): Promise<Map<string, string>> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([...RULE_CONFIGURATIONS], {
            rules: true,
            level: level,
        }),
        ...files,
    });
    const session = await openSession(sandbox.path);
    const output = generate(session);
    return new Map(output.files.filter((file) => file.kind === 'rules').map((file) => [file.path, file.content]));
}

test('rules > level filtering respects fenced examples, nested sections, and the next heading of the same depth', async () => {
    const before = '# Guide\n\n## Required\n\n```md\n## Example\n<!-- level: all -->\n```\n\n';
    const omitted =
        '## Convention\n<!-- level: all -->\n\nContent.\n\n### Detail\n<!-- level: all -->\n\n```md\n## Not a boundary\n```\n\n';
    const after = '## Safety\n\nKeep this requirement.\n';
    const text = before + omitted + after;
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['bash'], { rules: true }),
        'rules/GUIDE.md': text,
    });
    const session = await openSession(sandbox.path);
    const manifest = {
        ...readManifests(createReadCache(process.cwd())).get('bash')!,
        folder: sandbox.path.replaceAll('\\', '/'),
        rules: {},
    };
    using _list = spyOn(assets, 'listAssets').mockReturnValue([`${manifest.folder}/rules/GUIDE.md`]);
    using _read = spyOn(assets, 'readAsset').mockImplementation((path) => readFileSync(path, 'utf8'));
    const recommended = selectRuleFiles({
        ...session,
        scopes: [{ ...session.scopes[0]!, selected: [manifest] }],
        settingsFile: {
            ...session.settingsFile,
            settings: { ...session.settingsFile.settings, level: 'recommended' },
        },
    });
    expect(recommended.map(({ content }) => content)).toStrictEqual([before + after]);
    const all = selectRuleFiles({
        ...session,
        scopes: [{ ...session.scopes[0]!, selected: [manifest] }],
        settingsFile: { ...session.settingsFile, settings: { ...session.settingsFile.settings, level: 'all' } },
    });
    expect(all.map(({ content }) => content)).toStrictEqual([text]);
    writeFileSync(join(sandbox.path, 'rules/GUIDE.md'), before + after);
    expect(
        selectRuleFiles({
            ...session,
            scopes: [{ ...session.scopes[0]!, selected: [manifest] }],
            settingsFile: {
                ...session.settingsFile,
                settings: { ...session.settingsFile.settings, level: 'recommended' },
            },
        }).map(({ content }) => content),
    ).toStrictEqual([before + after]);
});

test.each(['', 'app'].flatMap((scope) => RUNTIME_RULE_CASES.map((row) => ({ ...row, scope }))))(
    'rules > $runtime rules with $dependency in $scope select DENO.md and NODE.md',
    async ({ scope, runtime, dependency, hasNode }) => {
        const prefix = scope === '' ? '' : scope + '/';
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText(scope === '' ? ['javascript'] : [], {
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
        const files = selectRuleFiles({
            ...session,
            settingsFile: { ...session.settingsFile, settings: { ...session.settingsFile.settings, level: 'all' } },
        });
        const paths = files.map((file) => file.path);
        expect(paths.includes('language/javascript/DENO.md')).toBe(runtime === 'deno');
        expect(paths.includes('language/javascript/NODE.md')).toBe(hasNode);
        expect(paths).not.toContain('platform/supabase/DENO.md');
        expect(paths).toContain('general/engineering/agent/TALKING.md');
    },
);

test('rules > an always-selected configuration installs its rule file once', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSettingsText([], { rules: true, level: 'all' }) });
    const session = await openSession(sandbox.path);
    const engineering = listSelectedManifests(session.scopes).find(
        (manifest) => manifest.configuration.name === 'engineering',
    )!;
    const manifests = listSelectedManifests(session.scopes);
    for (const selected of [manifests, [...manifests, engineering]]) {
        const files = selectRuleFiles({
            ...session,
            scopes: [{ ...session.scopes[0]!, selected: selected }],
            settingsFile: { ...session.settingsFile, settings: { ...session.settingsFile.settings, level: 'all' } },
        });
        expect(files.filter((file) => file.path === 'general/engineering/agent/TALKING.md')).toHaveLength(1);
    }
});

async function buildManagedBlock(root: string): Promise<string> {
    const session = await openSession(root);
    const { level } = session.settingsFile.settings;
    const selected = listSelectedManifests(session.scopes);
    const generated = generate(session);
    return buildAgentsBlock({
        generatedPaths: generated.files.map(({ path }) => path).filter((path) => !path.startsWith('.gspot/')),
        fileEdits: generated.fileEdits.map(({ path, changes }) => ({
            path,
            keys: changes.map((change) => change.path.join('.')),
        })),
        level,
        files: selectRuleFiles({
            ...session,
            scopes: [{ ...session.scopes[0]!, selected: selected }],
            settingsFile: { ...session.settingsFile, settings: { ...session.settingsFile.settings, level: level } },
        }),
        startCommand: session.startRunner.command,
        hasChecks: listChecksById(selected).size > 0,
    });
}

test('rules > the managed block > with no configurations the block still lists the general rules and the check command', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildSettingsText([], { rules: true }) });
    const block = await buildManagedBlock(sandbox.path);
    expect(block).toContain('agent/WORKING.md');
    expect(block).toContain('Run `mise exec -- gspot check --staged`.');
    expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
});

test('rules > the managed block > with a check selected the block names the command, and an excluded file leaves the index', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['spelling'], {
            rules: true,
            tables: '\n[rules]\nexclude = [".gspot/rules/general/engineering/code/ACCESSIBILITY.md"]\n',
        }),
    });
    const block = await buildManagedBlock(sandbox.path);
    expect(block).toContain('Run `mise exec -- gspot check --staged`.');
    expect(block).not.toContain('ACCESSIBILITY.md');
    expect(block).toContain('code/TESTING.md');
    expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
});

describe('rules', () => {
    let recommended: ReadonlyMap<string, string>;

    let all: ReadonlyMap<string, string>;

    beforeAll(async () => {
        recommended = await generateRuleFiles('recommended', {});
        all = await generateRuleFiles('all', {});
    });

    test('a rule file whose sections are all for level all is written only at all', () => {
        expect(recommended.has(`${RULES_PATH}/general/naming/NAMING.md`)).toBe(false);
        expect(all.has(`${RULES_PATH}/general/naming/NAMING.md`)).toBe(true);
        expect(recommended.has(`${RULES_PATH}/general/engineering/agent/WORKING.md`)).toBe(true);
    });

    test('rule files that need a file or a dependency are written only when it is there', async () => {
        const present = await generateRuleFiles('all', {
            'bunfig.toml': '[test]\nroot = "tests"\n',
            'package.json':
                '{"name":"example","devDependencies":{"tailwindcss":"4.1.0","@playwright/test":"1.50.0"}}\n',
        });
        for (const path of [
            'language/javascript/BUN.md',
            'language/css/TAILWIND.md',
            'language/javascript/PLAYWRIGHT.md',
        ]) {
            expect(all.has(`${RULES_PATH}/${path}`)).toBe(false);
            expect(present.has(`${RULES_PATH}/${path}`)).toBe(true);
        }
    });

    test('Swift rule files need a real import, not one in a comment or string', async () => {
        const absent = await generateRuleFiles('all', {
            'View.swift': '// import UIKit\nlet text = "import SwiftUI"\n',
        });
        const present = await generateRuleFiles('all', { 'View.swift': 'import SwiftUI\nimport class UIKit.UIView\n' });
        for (const path of ['language/swift/SWIFTUI.md', 'language/swift/UIKIT.md']) {
            expect(absent.has(`${RULES_PATH}/${path}`)).toBe(false);
            expect(present.has(`${RULES_PATH}/${path}`)).toBe(true);
        }
    });

    test.each([...DRIZZLE_DRIVERS])(
        'the Drizzle rules are written only for a PostgreSQL driver: $driver',
        async ({ driver, postgres }) => {
            const guides = await generateRuleFiles('all', {
                'package.json': JSON.stringify({ dependencies: { 'drizzle-orm': '0.45.1', [driver]: '1.0.0' } }),
            });
            expect(guides.has(`${RULES_PATH}/library/drizzle/DRIZZLE.md`)).toBe(postgres);
        },
    );
});
test('a React dependency selects COMPONENTS.md', async () => {
    await using sandbox = await testdir({
        'gspot.toml': 'configurations = ["javascript"]\n',
        'package.json': '{"dependencies":{"react":"19.2.0"}}',
    });
    const session = await openSession(sandbox.path);
    expect(selectRuleFiles(session).map(({ path }) => path)).toContain('language/javascript/COMPONENTS.md');
});
test.each([
    [EARLIER_CLAUDE_BLOCK, undefined],
    [`${EARLIER_CLAUDE_BLOCK}\n${OWN_CLAUDE_TEXT}`, OWN_CLAUDE_TEXT],
])('apply removes the CLAUDE.md block of gspot 0.2.0 and keeps your own text: %j', async (earlier, kept) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText([], { rules: true }),
        'CLAUDE.md': earlier,
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8')).toContain('agent/WORKING.md');
    expect(await readFile(join(sandbox.path, 'CLAUDE.md'), 'utf8').catch(() => undefined)).toBe(kept);
});
