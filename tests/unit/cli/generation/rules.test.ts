import { join } from 'node:path';
import { format } from 'prettier';
import { testdir } from 'testdirs';
import { readFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import * as assets from '#cli/system/assets.ts';
import { type Session } from '#cli/types/session.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { generate } from '#cli/generation/generate.ts';
import { type Level } from '#cli/types/configurations.ts';
import { type RuleFile } from '#cli/types/generation/rules.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { test, spyOn, expect, describe, beforeAll } from 'bun:test';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { GSPOT_CONFIGURATIONS_PATH } from '#cli/config/gspot-paths.ts';
import { START_RUNNERS } from '#cli/config/repository/package-manager.ts';
import { listSelectedConfigurations } from '#cli/configurations/select.ts';
import { selectRuleFiles, buildAgentsBlock } from '#cli/generation/rules.ts';

import {
    JAVASCRIPT_IN_APP,
    RUNTIME_RULE_CASES,
    RULE_CONFIGURATIONS,
    RULE_CORRECTNESS_CASES,
    NAMING_RULE_LEVEL_CASES,
} from '#tests/data/rules.ts';

async function generateRuleFiles(level: Level, files: Record<string, string>): Promise<Map<string, string>> {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([...RULE_CONFIGURATIONS], {
            rules: true,
            level: level,
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

/** Select rule files at one level without changing the session's saved settings. */
function selectRulesAt(session: Session, level: Level, scopes: Session['scopes']): RuleFile[] {
    return selectRuleFiles({
        ...session,
        scopes,
        settingsFile: { ...session.settingsFile, settings: { ...session.settingsFile.settings, level } },
    });
}

test('level filtering respects fenced examples, nested sections, and the next heading of the same depth', async () => {
    const before = '# Guide\n\n## Required\n\n```md\n## Example\n<!-- level: all -->\n```\n\n';
    const omitted =
        '## Convention\n<!-- level: all -->\n\nContent.\n\n### Detail\n<!-- level: all -->\n\n```md\n## Not a boundary\n```\n\n';
    const after = '## Safety\n\nKeep this requirement.\n';
    const text = before + omitted + after;
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'rules/GUIDE.md': text,
    });
    const session = await openSession(sandbox.path);
    const configuration = {
        ...readConfigurations().get('bash')!,
        folder: sandbox.path.replaceAll('\\', '/'),
        rules: {},
    };
    using _list = spyOn(assets, 'listAssets').mockReturnValue([`${configuration.folder}/rules/GUIDE.md`]);
    using _read = spyOn(assets, 'readAsset').mockImplementation((path) => readFileSync(path, 'utf8'));
    const recommended = selectRulesAt(session, 'recommended', [{ ...session.scopes[0]!, selected: [configuration] }]);
    expect(recommended.map(({ content }) => content)).toStrictEqual([before + after]);
    const all = selectRulesAt(session, 'all', [{ ...session.scopes[0]!, selected: [configuration] }]);
    expect(all.map(({ content }) => content)).toStrictEqual([text]);
    writeFileSync(join(sandbox.path, 'rules/GUIDE.md'), before + after);
    expect(
        selectRulesAt(session, 'recommended', [{ ...session.scopes[0]!, selected: [configuration] }]).map(
            ({ content }) => content,
        ),
    ).toStrictEqual([before + after]);
});

test.each(['', 'app'].flatMap((scope) => RUNTIME_RULE_CASES.map((row) => ({ ...row, scope }))))(
    '$runtime rules with $dependency in scope $scope select DENO.md and NODE.md',
    async ({ scope, runtime, dependency, hasNode }) => {
        const prefix = scope === '' ? '' : scope + '/';
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(scope === '' ? ['javascript'] : [], {
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
        const files = selectRulesAt(session, 'all', session.scopes);
        const paths = files.map((file) => file.path);
        expect(paths.includes('language/javascript/rules/DENO.md')).toBe(runtime === 'deno');
        expect(paths.includes('language/javascript/rules/NODE.md')).toBe(hasNode);
        expect(paths).not.toContain('platform/supabase/rules/DENO.md');
        expect(paths).toContain('general/engineering/rules/TALKING.md');
    },
);

test('the AGENTS.md block names the folders of a scoped rule without parentheses', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables: JAVASCRIPT_IN_APP }),
        'app/main.js': 'console.log("ready");\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const agents = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('/JAVASCRIPT.md` in `app/`: ');
    expect(agents).not.toContain('(app/)');
});

test('an always-selected configuration installs its rule file once', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([], { rules: true, level: 'all' }) });
    const session = await openSession(sandbox.path);
    const configurations = listSelectedConfigurations(session.scopes);
    const engineering = configurations.find((configuration) => configuration.name === 'engineering')!;
    for (const selected of [configurations, [...configurations, engineering]]) {
        const files = selectRulesAt(session, 'all', [{ ...session.scopes[0]!, selected: selected }]);
        expect(files.filter((file) => file.path === 'general/engineering/rules/TALKING.md')).toHaveLength(1);
    }
});

test('with no configurations the block still lists the general rules and the check command', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings([], { rules: true }) });

    const block = generate(await openSession(sandbox.path)).blocks.find(({ path }) => path === 'AGENTS.md')!.block;
    expect(block).toContain('engineering/rules/WORKING.md');
    expect(block).toContain('gspot check --staged');
    expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
});

test('with a check selected the block names the command, and an excluded file leaves the index', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['spelling'], {
            rules: true,
            tables: '\n[rules]\nexclude = [".gspot/configurations/general/engineering/rules/ACCESSIBILITY.md"]\n',
        }),
    });

    const block = generate(await openSession(sandbox.path)).blocks.find(({ path }) => path === 'AGENTS.md')!.block;
    expect(block).toContain('gspot check --staged');
    expect(block).not.toContain('ACCESSIBILITY.md');
    expect(block).toContain('engineering/rules/TESTING.md');
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
        expect(recommended.has(`${GSPOT_CONFIGURATIONS_PATH}/general/naming/rules/NAMING.md`)).toBe(false);
        expect(all.has(`${GSPOT_CONFIGURATIONS_PATH}/general/naming/rules/NAMING.md`)).toBe(true);
        expect(recommended.has(`${GSPOT_CONFIGURATIONS_PATH}/general/engineering/rules/WORKING.md`)).toBe(true);
    });

    test('rule files that need a file or a dependency are written only when it is there', async () => {
        const present = await generateRuleFiles('all', {
            'bunfig.toml': '[test]\nroot = "tests"\n',
            'package.json':
                '{"name":"example","devDependencies":{"tailwindcss":"4.1.0","@playwright/test":"1.50.0"}}\n',
        });
        for (const path of [
            'language/javascript/rules/BUN.md',
            'language/css/rules/TAILWIND.md',
            'language/javascript/rules/PLAYWRIGHT.md',
        ]) {
            expect(all.has(`${GSPOT_CONFIGURATIONS_PATH}/${path}`)).toBe(false);
            expect(present.has(`${GSPOT_CONFIGURATIONS_PATH}/${path}`)).toBe(true);
        }
    });

    test('Swift rule files need a real import, not one in a comment or string', async () => {
        const absent = await generateRuleFiles('all', {
            'View.swift': '// import UIKit\nlet text = "import SwiftUI"\n',
        });
        const present = await generateRuleFiles('all', { 'View.swift': 'import SwiftUI\nimport class UIKit.UIView\n' });
        for (const path of ['language/swift/rules/SWIFTUI.md', 'language/swift/rules/UIKIT.md']) {
            expect(absent.has(`${GSPOT_CONFIGURATIONS_PATH}/${path}`)).toBe(false);
            expect(present.has(`${GSPOT_CONFIGURATIONS_PATH}/${path}`)).toBe(true);
        }
    });
});

test('the AGENTS.md block moves its headings one level down in a file with its own title', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        'AGENTS.md': '# Shop\n\nHow agents work here.\n\n```bash\n# not a heading\n```\n',
    });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const agents = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    expect(agents.split('\n').filter((line) => line.startsWith('# '))).toStrictEqual(['# Shop', '# not a heading']);
    expect(agents).toContain('## Rules\n');
    expect(agents).toContain('### Commands\n');
    const again = await runGspot(sandbox.path, ['apply']);
    expect(again.code, again.stdout + again.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8')).toBe(agents);
});

test.each(
    Object.values(START_RUNNERS).flatMap(({ command }) => [true, false].map((hasChecks) => ({ command, hasChecks }))),
)(
    'the AGENTS.md block explains the short gspot command as $command with checks=$hasChecks',
    ({ command, hasChecks }) => {
        const block = buildAgentsBlock({
            files: [],
            generatedPaths: [],
            managedKeys: [],
            hasOwnTitle: false,
            hasChecks,
            startCommand: command,
        });
        expect(block).toContain(`## Commands\n\nThe rules write \`gspot\` for \`${command}\`.\n\n`);
    },
);

test.each([...NAMING_RULE_LEVEL_CASES])(
    'recommended omits the complete Naming section of $configuration rules and all retains it',
    async ({ configuration, path }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([configuration], { rules: true }),
        });
        const session = await openSession(sandbox.path);
        const recommended = selectRuleFiles(session).find((file) => file.path === path);
        expect(recommended).toBeDefined();
        expect(recommended?.content).not.toContain('## Naming');
        const all = selectRulesAt(session, 'all', session.scopes).find((file) => file.path === path);
        expect(all?.content).toContain('## Naming');
        expect(all?.content).toContain('### ');
    },
);

test.each([...RULE_CORRECTNESS_CASES])(
    'recommended retains the correctness and security instructions in $path',
    async ({ configuration, path, instructions }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([configuration], { rules: true }),
        });
        const session = await openSession(sandbox.path);
        const rule = selectRuleFiles(session).find((file) => file.path === path);
        for (const instruction of instructions) expect(rule?.content.replaceAll(/\s+/gu, ' ')).toContain(instruction);
    },
);

test('recommended Python typing rules retain the guidance without a reference to a removed example', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python'], { rules: true }),
    });
    const session = await openSession(sandbox.path);
    const rule = selectRuleFiles(session).find((file) => file.path === 'language/python/rules/TYPING.md');
    expect(rule?.content).toContain('## Any, object, and shapes');
    expect(rule?.content).not.toContain('as `Key` does above');
});
