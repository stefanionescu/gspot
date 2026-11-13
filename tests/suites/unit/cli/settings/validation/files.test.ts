import { symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { FIRST_READ } from '#cli/config/settings/validation.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { createTemporaryFolder } from '#cli/system/files/temporary.ts';
import { RULE_FILE_ERRORS, RULE_FILE_SETTINGS } from '#tests/config/settings/validation.ts';
import { getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('rule_files.exclude accepts a rule file path', () => {
    const exclude = [getRuleFilePath('agents', 'ACCESSIBILITY.md')];
    expect(validateSettingsText(stringify({ rule_files: { exclude } }))).toStrictEqual([]);
});

test('a rule_files.exclude path that matches no rule file names the near match', () => {
    using sandbox = createTemporaryFolder();
    const misspelled = getRuleFilePath('agents', 'ACCESSIBILITY.md').replace(/\.md$/u, '.txt');
    const near = getRuleFilePath('agents', 'ACCESSIBILITY.md');
    expect(() => parseSettings(stringify({ rule_files: { exclude: [misspelled] } }), sandbox.path)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'settings',
            message: expect.stringContaining(near) as string,
        }),
    );
});

test.each([`${GSPOT_PATHS.rules}/${FIRST_READ[0] as string}`, GSPOT_PATHS.rules])(
    'rule_files.exclude refuses %s, a rule file that every agent reads first',
    (ruleFile) => {
        expect(validateSettingsText(stringify({ rule_files: { exclude: [ruleFile] } }))).toStrictEqual([
            `gspot.toml:2: rule_files.exclude.0: [rule_files] exclude names ${ruleFile}, which holds a file every agent opens first (${FIRST_READ.join(', ')}). Remove the entry.`,
        ]);
    },
);

test('a scope path through a link to a folder outside the repository is refused', async () => {
    await using sandbox = await testdir({ 'project/.keep': '', 'outside/nested/sentinel': 'unchanged' });

    const root = join(sandbox.path, 'project');
    await symlink('../outside', join(root, 'linked'));
    const found = validateSettingsText(
        buildSandboxSettings(['bash'], { rules: true, scopes: [{ path: 'linked' }] }),
        root,
    );
    expect(found).toStrictEqual(['gspot.toml:4: scope.0.path: linked is a link. gspot does not write through links.']);
});

test('a Semgrep rule file or a scope plugin module that names no file is refused at its key', async () => {
    await using sandbox = await testdir({
        'present.mjs': 'export default {};',
        'present.yml': 'rules: []',
        'app/present.mjs': 'export default {};',
        'app/present.yml': 'rules: []',
    });
    const text = stringify(RULE_FILE_SETTINGS);
    const errors = validateSettingsText(text, sandbox.path);
    expect(errors).toHaveLength(RULE_FILE_ERRORS.length);
    for (const [index, start] of RULE_FILE_ERRORS.entries()) expect(errors[index]).toStartWith(start);
    const corrected = text
        .replaceAll(/missing-(?:root|scope)\.mjs/gu, 'present.mjs')
        .replaceAll(/missing-(?:root|scope)\.yml/gu, 'present.yml');
    expect(validateSettingsText(corrected, sandbox.path)).toStrictEqual([]);
});

test('linked ESLint plugins and Semgrep rule files fail settings validation at their keys', async () => {
    await using sandbox = await testdir({ 'project/.keep': '', 'outside/plugin.mjs': 'export default {};' });
    const root = join(sandbox.path, 'project');
    await symlink('../outside/plugin.mjs', join(root, 'local.mjs'));
    expect(
        validateSettingsText(
            stringify({
                configurations: ['javascript', 'security'],
                tools: { eslint: { plugins: [{ name: 'local', path: 'local.mjs', rules: {} }] } },
                security: { semgrep_rules: ['local.mjs'] },
            }),
            root,
        ),
    ).toStrictEqual([
        'gspot.toml:4: tools.eslint.plugins.0.path: local.mjs is a link. gspot does not write through links.',
        'gspot.toml:7: security.semgrep_rules.0: local.mjs is a link. gspot does not write through links.',
    ]);
});

test('relative folders with spaces, percent signs and Unicode are accepted', async () => {
    const path = 'apps/café 100%';
    await using sandbox = await testdir({ [`${path}/source.ts`]: 'export const count = 1;\n' });

    const settings = parseSettings(stringify({ scope: [{ path }] }), sandbox.path)
        .scopes.keys()
        .toArray();
    expect(settings).toStrictEqual([path]);
});

test('a scope path that names a file is refused', async () => {
    await using sandbox = await testdir({ 'README.md': '# Example\n' });
    expect(validateSettingsText('[[scope]]\npath = "README.md"\n', sandbox.path)).toStrictEqual([
        'gspot.toml:2: scope.0.path: The scope README.md names a file. Name a folder under the repository root.',
    ]);
});

test('a rule file path that names a folder is refused', async () => {
    await using sandbox = await testdir({ rules: {} });
    expect(validateSettingsText('[security]\nsemgrep_rules = ["rules"]\n', sandbox.path)).toStrictEqual([
        'gspot.toml:2: security.semgrep_rules.0: rules names no file. Point semgrep_rules at a file, relative to its table.',
    ]);
});
