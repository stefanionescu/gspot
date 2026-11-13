import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { format } from 'prettier';

import { COMMANDS_HEADING } from '#cli/config/generation/files.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/repository/files.ts';
import { openSession } from '#cli/engine/session.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { buildAgentsBlock, selectRuleFiles } from '#cli/generation/rules.ts';
import { listRuleFiles, readConfigurations } from '#cli/manifests/read.ts';
import { findSettingSchema } from '#cli/settings/lookup.ts';
import * as assets from '#cli/system/assets.ts';
import type { Level } from '#cli/types/settings.ts';
import { RUNTIME_RULE_CASES } from '#tests/config/generation/generate.ts';
import { getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

/**
Select the rule files of a sandbox whose one configuration ships the given text as its one rule file.
*/
async function selectGuideContents(text: string, level: Level): Promise<string[]> {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true, level }),
        'rules/GUIDE.md': text,
    });
    const session = await openSession(sandbox.path);
    const configuration = {
        ...readConfigurations().get('bash')!,
        folder: sandbox.path.replaceAll('\\', '/'),
        rules: {},
    };
    using _list = spyOn(assets, 'listAssets').mockReturnValue([`${configuration.folder}/rules/GUIDE.md`]);
    using _read = spyOn(assets, 'buildAssetPath').mockImplementation((path) => path);
    const scopes = [{ ...session.scopes[0]!, configurations: [configuration] }];
    return selectRuleFiles({ ...session, scopes }).map(({ content }) => content);
}

async function buildAgentsBody(files: Record<string, string>): Promise<string> {
    await using sandbox = await createGitSandbox(files);
    const generated = buildGeneratedFiles(await openSession(sandbox.path));
    return generated.blocks.find(({ path }) => path === 'AGENTS.md')!.body;
}

function listIndexPaths(block: string): Array<string | undefined> {
    const index = block.slice(0, block.indexOf(COMMANDS_HEADING));
    return index
        .matchAll(/^- `([^`]+)`/gmu)
        .map(([, path]) => path)
        .toArray();
}

test.each([...RUNTIME_RULE_CASES])('$name selects the runtime rules $rules', async ({ runtime, rules }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { rules: true, level: 'all' }),
        'main.js': `#!/usr/bin/env ${runtime}\nconsole.log("ready");\n`,
        'package.json': JSON.stringify({
            engines: { [runtime]: '>=1' },
        }),
    });
    const session = await openSession(sandbox.path);
    const paths = selectRuleFiles(session).map((file) => file.path);
    expect(paths.filter((path) => /^DENO\.md$/u.test(path))).toStrictEqual([...rules]);
});

test('a rule file shows the limit that gspot.toml sets', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['markdown'], {
            rules: true,
            level: 'all',
            tables: '[prose]\nmax_sentence_words = 24\n',
        }),
    });
    const session = await openSession(sandbox.path);
    const writing = selectRuleFiles(session).find(({ path }) => path.endsWith('WRITING.md'));
    expect(writing?.content).toContain('Keep a sentence within 24 words');
    expect(writing?.content).not.toContain('{setting:');
});

test('at level basic, a rule file loses its level-all sections with their subsections, but keeps fenced examples and the next heading of the same depth', async () => {
    const before = '# Guide\n\n## Required\n\n```md\n## Example\n<!-- level: all -->\n```\n\n';
    const omitted =
        '## Convention\n<!-- level: all -->\n\nContent.\n\n### Detail\n<!-- level: all -->\n\n```md\n## Not a boundary\n```\n\n';
    const after = '## Safety\n\nKeep this requirement.\n';
    const text = before + omitted + after;
    expect(await selectGuideContents(text, 'basic')).toStrictEqual([before + after]);
    expect(await selectGuideContents(text, 'all')).toStrictEqual([
        before + '## Convention\n\nContent.\n\n### Detail\n\n```md\n## Not a boundary\n```\n\n' + after,
    ]);
});

test('a rule file whose sections are all for level all is written only at all', async () => {
    const text = '# Guide\n\n## Convention\n<!-- level: all -->\n\nContent.\n';
    expect(await selectGuideContents(text, 'basic')).toStrictEqual([]);
    expect(await selectGuideContents(text, 'all')).toStrictEqual(['# Guide\n\n## Convention\n\nContent.\n']);
});

test.each([
    { name: 'without tailwindcss', dependencies: {}, rules: [] },
    { name: 'with tailwindcss', dependencies: { tailwindcss: '4.1.0' }, rules: ['TAILWIND.md'] },
])(
    'a rule file that needs a dependency is written only when the repository declares it: $name',
    async ({ dependencies, rules }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['css'], { rules: true, level: 'all' }),
            'package.json': JSON.stringify({ name: 'example', devDependencies: dependencies }),
        });
        const paths = selectRuleFiles(await openSession(sandbox.path)).map(({ path }) => path);
        expect(paths.filter((path) => path === 'TAILWIND.md')).toStrictEqual([...rules]);
    },
);

test('each setting that a shipped rule file names exists', () => {
    const names = readConfigurations()
        .values()
        .flatMap((configuration) => listRuleFiles(configuration))
        .flatMap(({ source }) => readFileSync(assets.buildAssetPath(source), 'utf8').matchAll(SETTING_PLACEHOLDER))
        .map((match) => match[1]!)
        .toArray();
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => findSettingSchema(name) === undefined)).toStrictEqual([]);
});

test('the AGENTS.md block names the folders of a scoped rule without parentheses', async () => {
    const block = await buildAgentsBody({
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: '[[scope]]\npath = "app"\nconfigurations = ["javascript"]\n',
        }),
        'app/main.js': 'console.log("ready");\n',
    });
    expect(block.split('\n').find((line) => line.includes('/JAVASCRIPT.md`'))).toContain('` in `app/`: ');
});

test('with no configurations the block still lists the general rules', async () => {
    const block = await buildAgentsBody({ 'gspot.toml': buildSandboxSettings([], { rules: true }) });
    const paths = listIndexPaths(block);
    expect(paths).toContain('.gspot/rules/TESTING.md');
    expect(await format(`${block}\n`, { parser: 'markdown' })).toBe(`${block}\n`);
});

test('a rule file that rule_files.exclude names leaves the index', async () => {
    const block = await buildAgentsBody({
        'gspot.toml': buildSandboxSettings(['spelling'], {
            rules: true,
            tables: `[rule_files]\nexclude = ["${getRuleFilePath('agents', 'CLI.md')}"]\n`,
        }),
    });
    const paths = listIndexPaths(block);
    expect(paths).not.toContain('.gspot/rules/CLI.md');
    expect(paths).toContain('.gspot/rules/TESTING.md');
});

test('the AGENTS.md block moves its headings one level down in a file with its own title', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true }),
        'AGENTS.md': '# Shop\n\nHow agents work here.\n\n```bash\n# not a heading\n```\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const agents = await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8');
    expect(agents.split('\n').filter((line) => /^#+ /u.test(line))).toStrictEqual([
        '# Shop',
        '# not a heading',
        '## Rules',
        '### Commands',
    ]);
});

test('the AGENTS.md Commands section names its launcher once', () => {
    const command = 'pnpm exec gspot';
    const block = buildAgentsBlock({ files: [], hasOwnTitle: false, startCommand: command, hooksEnabled: true });
    const commands = block.slice(block.indexOf(COMMANDS_HEADING)).split('\n');
    expect(commands.filter((line) => line.includes(command))).toHaveLength(1);
});

test.each([true, false])(
    'with hooks enabled %p, the AGENTS.md block names the check before a push only without hooks',
    (hooksEnabled) => {
        const block = buildAgentsBlock({ files: [], hasOwnTitle: false, startCommand: 'gspot', hooksEnabled });
        expect(block.includes('gspot check --base origin/HEAD')).toBe(!hooksEnabled);
    },
);

test('the AGENTS.md index keeps a rule opening that wraps onto a second line', () => {
    const block = buildAgentsBlock({
        files: [
            {
                path: 'SAFETY.md',
                target: '.gspot/rules/SAFETY.md',
                content:
                    '# Bash Safety\n\nRead this rule when a shell script deletes files, or parses JSON or\nYAML.\n\n## Calling\n',
                scopes: [''],
            },
        ],
        hasOwnTitle: false,
        startCommand: 'gspot',
        hooksEnabled: true,
    });
    expect(block).toContain('/SAFETY.md`: when a shell script deletes files, or parses JSON or YAML.\n');
});
