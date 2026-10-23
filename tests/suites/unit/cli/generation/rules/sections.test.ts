import { join } from 'node:path';
import { testdir } from 'testdirs';
import { writeFileSync } from 'node:fs';
import { openSession } from '#cli/session.ts';
import { test, spyOn, expect } from 'bun:test';
import * as assets from '#cli/system/assets.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { RULE_CORRECTNESS_CASES, NAMING_RULE_LEVEL_CASES } from '#tests/config/generation/rules.ts';

test('at level recommended, a rule file loses its level-all sections with their subsections, but keeps fenced examples and the next heading of the same depth', async () => {
    const before = '# Guide\n\n## Required\n\n```md\n## Example\n<!-- level: all -->\n```\n\n';
    const omitted =
        '## Convention\n<!-- level: all -->\n\nContent.\n\n### Detail\n<!-- level: all -->\n\n```md\n## Not a boundary\n```\n\n';
    const after = '## Safety\n\nKeep this requirement.\n';
    const text = before + omitted + after;
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'rules/GUIDE.md': text,
    });
    const recommended = await openSession(sandbox.path);
    writeFileSync(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['bash'], { rules: true, level: 'all' }));
    const all = await openSession(sandbox.path);
    const configuration = {
        ...readConfigurations().get('bash')!,
        folder: sandbox.path.replaceAll('\\', '/'),
        rules: {},
    };
    using _list = spyOn(assets, 'listAssets').mockReturnValue([`${configuration.folder}/rules/GUIDE.md`]);
    using _read = spyOn(assets, 'buildAssetPath').mockImplementation((path) => path);
    const recommendedScopes = [{ ...recommended.scopes[0]!, configurations: [configuration] }];
    const omittedFiles = selectRuleFiles({ ...recommended, scopes: recommendedScopes });
    expect(omittedFiles.map(({ content }) => content)).toStrictEqual([before + after]);
    const allFiles = selectRuleFiles({ ...all, scopes: [{ ...all.scopes[0]!, configurations: [configuration] }] });
    expect(allFiles.map(({ content }) => content)).toStrictEqual([
        before + '## Convention\n\nContent.\n\n### Detail\n\n```md\n## Not a boundary\n```\n\n' + after,
    ]);
    writeFileSync(join(sandbox.path, 'rules/GUIDE.md'), before + after);
    const keptFiles = selectRuleFiles({ ...recommended, scopes: recommendedScopes });
    expect(keptFiles.map(({ content }) => content)).toStrictEqual([before + after]);
});

test.each([...NAMING_RULE_LEVEL_CASES])(
    'recommended omits the complete Naming section of $configuration rules and all retains it',
    async ({ configuration, path }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([configuration], { rules: true }),
        });
        const session = await openSession(sandbox.path);
        const recommended = selectRuleFiles(session).find((file) => file.path === path);
        expect(recommended?.path).toBe(path);
        expect(recommended?.content).not.toContain('## Naming');
        writeFileSync(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings([configuration], { rules: true, level: 'all' }),
        );
        const all = selectRuleFiles(await openSession(sandbox.path)).find((file) => file.path === path);
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
