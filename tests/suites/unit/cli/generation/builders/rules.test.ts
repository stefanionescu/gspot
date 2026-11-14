import { readFileSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import type { Level } from '#cli/types/settings.ts';
import { openSession } from '#cli/engine/session.ts';
import * as assets from '#cli/system/package/assets.ts';
import { findSettingSchema } from '#cli/settings/lookup.ts';
import { selectRuleFiles } from '#cli/generation/builders/rules.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/repository/files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { listRuleFiles, readConfigurations } from '#cli/manifests/read.ts';
import { RUNTIME_RULE_CASES, PLAYWRIGHT_RULE_CASES } from '#tests/config/generation/builders.ts';

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

test.each([...PLAYWRIGHT_RULE_CASES])('$name', async ({ files, rules }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { rules: true }),
        ...files,
    });
    const session = await openSession(sandbox.path);
    const paths = selectRuleFiles(session).map((file) => file.path);
    expect(paths.filter((path) => path === 'PLAYWRIGHT.md')).toStrictEqual([...rules]);
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
        `${before}## Convention\n\nContent.\n\n### Detail\n\n\`\`\`md\n## Not a boundary\n\`\`\`\n\n${after}`,
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
