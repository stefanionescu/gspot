import { join } from 'node:path';
import { testdir } from 'testdirs';
import { writeFileSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import * as assets from '#cli/system/assets.ts';
import { openSession } from '#cli/planning/session.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';

test('at level basic, a rule file loses its level-all sections with their subsections, but keeps fenced examples and the next heading of the same depth', async () => {
    const before = '# Guide\n\n## Required\n\n```md\n## Example\n<!-- level: all -->\n```\n\n';
    const omitted =
        '## Convention\n<!-- level: all -->\n\nContent.\n\n### Detail\n<!-- level: all -->\n\n```md\n## Not a boundary\n```\n\n';
    const after = '## Safety\n\nKeep this requirement.\n';
    const text = before + omitted + after;
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'rules/GUIDE.md': text,
    });
    const defaultLevel = await openSession(sandbox.path);
    writeFileSync(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['bash'], { rules: true, level: 'all' }));
    const all = await openSession(sandbox.path);
    const configuration = {
        ...readConfigurations().get('bash')!,
        folder: sandbox.path.replaceAll('\\', '/'),
        rules: {},
    };
    using _list = spyOn(assets, 'listAssets').mockReturnValue([`${configuration.folder}/rules/GUIDE.md`]);
    using _read = spyOn(assets, 'buildAssetPath').mockImplementation((path) => path);
    const defaultLevelScopes = [{ ...defaultLevel.scopes[0]!, configurations: [configuration] }];
    const omittedFiles = selectRuleFiles({ ...defaultLevel, scopes: defaultLevelScopes });
    expect(omittedFiles.map(({ content }) => content)).toStrictEqual([before + after]);
    const allFiles = selectRuleFiles({ ...all, scopes: [{ ...all.scopes[0]!, configurations: [configuration] }] });
    expect(allFiles.map(({ content }) => content)).toStrictEqual([
        before + '## Convention\n\nContent.\n\n### Detail\n\n```md\n## Not a boundary\n```\n\n' + after,
    ]);
    writeFileSync(join(sandbox.path, 'rules/GUIDE.md'), before + after);
    const keptFiles = selectRuleFiles({ ...defaultLevel, scopes: defaultLevelScopes });
    expect(keptFiles.map(({ content }) => content)).toStrictEqual([before + after]);
});

test.each(['basic', 'all'] as const)('the shipped Git commit format section follows level %s', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['commits'], { rules: true, level }),
    });
    const rules = selectRuleFiles(await openSession(sandbox.path));
    const git = rules.find(({ path }) => path === 'general/commits/rules/GIT.md')!;
    expect(git.content.includes('### Commit message format')).toBe(level === 'all');
    expect(git.content.includes('fix(api): reject an empty order')).toBe(level === 'all');
    expect(git.content).toContain('## Branches and pull requests');
});
