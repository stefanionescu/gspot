import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { stringify } from '@decimalturn/toml-patch';
import { parseSettings } from '#cli/settings/read.ts';
import { captureThrow } from '#tests/setup/matchers.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { FIRST_READ } from '#cli/config/generation/rules.ts';
import { REVIEWED_REASON } from '#tests/config/settings/samples.ts';
import { findRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';

import {
    EMPTY_REASONS,
    VALID_LICENSES,
    KEY_PATH_CASES,
    INVALID_LICENSES,
    RULE_FILE_ERRORS,
    UNKNOWN_KEY_CASES,
    RULE_FILE_SETTINGS,
    DUPLICATED_REASON_ERRORS,
    INVALID_MARKDOWNLINT_NAMES,
    SCOPE_CONFIGURATION_SETTINGS,
} from '#tests/config/settings/read.ts';

test.each(INVALID_MARKDOWNLINT_NAMES)('markdownlint refuses $name with the rule ID guidance', ({ name, value }) => {
    expect(
        validateSettingsText(
            stringify({ configurations: ['markdown'], tools: { markdownlint: { rules: { [name]: value } } } }),
        ),
    ).toStrictEqual([
        `gspot.toml: tools.markdownlint.rules.${name}: Name a rule by its ID, such as MD010 = { spaces_per_tab = 4 }. This table holds rule options only.`,
    ]);
});

test.each(DUPLICATED_REASON_ERRORS)('an invalid $key reason is reported once', ({ text, message }) => {
    expect(validateSettingsText(buildSandboxSettings(['bash', 'docs'], { tables: text }))).toStrictEqual([message]);
});

test.each(INVALID_LICENSES)('licenses.allowed refuses %s before running a check', (license) => {
    expect(validateSettingsText(stringify({ licenses: { allowed: [license] } }))).toStrictEqual([
        'gspot.toml: licenses.allowed.0: Use one SPDX license ID, such as MIT or Apache-2.0, not an AND or OR expression.',
    ]);
});

test.each(VALID_LICENSES)('licenses.allowed accepts one SPDX license: %s', (license) => {
    expect(validateSettingsText(stringify({ licenses: { allowed: [license] } }))).toStrictEqual([]);
});

test('two import rules cannot share a name', () => {
    const lower = { name: 'lower', paths: ['lower/**'], can_import: [] };
    const upper = { name: 'lower', paths: ['upper/**'], can_import: ['lower'] };
    expect(validateSettingsText(stringify({ import_rule: [lower, upper] }))).toStrictEqual([
        'gspot.toml: import_rule.1.name: Two [[import_rule]] records name lower. Keep one.',
    ]);
    expect(validateSettingsText(stringify({ import_rule: [lower, { ...upper, name: 'upper' }] }))).toStrictEqual([]);
});

test('the release age can be written at the root and cannot be written in a scope', () => {
    expect(validateSettingsText('[dependencies]\nmin_release_age_days = 30\n')).toStrictEqual([]);
    expect(
        validateSettingsText('[[scope]]\npath = "api"\n[scope.dependencies]\nmin_release_age_days = 30\n'),
    ).toStrictEqual([
        'gspot.toml: [[scope]] record 1 [dependencies]: `min_release_age_days` is not a gspot.toml setting. See generativespotting.com/reference/gspot-toml/ for every key.',
    ]);
});

test('a removed configuration without a reason names the remove command', () => {
    expect(validateSettingsText('removed_configurations = ["docs"]\n')).toStrictEqual([
        'gspot.toml: removed_configurations.reason: removed_configurations needs a reason. Run gspot remove <configuration> --reason "<why>".',
    ]);
    expect(validateSettingsText('[[scope]]\npath = "app"\nremoved_configurations = ["docs"]\n')).toStrictEqual([
        'gspot.toml: scope.0.removed_configurations.reason: scope.0.removed_configurations needs a reason. Run gspot remove <configuration> --reason "<why>".',
    ]);
});

test('a list without its required reason names the inline value and set command', () => {
    expect(
        validateSettingsText('configurations = ["docs"]\n[docs]\nallowed_urls = ["https://example.com/docs"]\n'),
    ).toStrictEqual([
        'gspot.toml: docs.allowed_urls.reason: docs.allowed_urls needs a reason. Write it as docs.allowed_urls = { value = [...], reason = "..." }, or run gspot set docs.allowed_urls ... --reason "<why>".',
    ]);
});

test('settings of an unselected language are refused while settings of automatic general configurations stay valid', () => {
    expect(validateSettingsText('configurations = ["bash"]\n[tools.sqlfluff]\ndialect = "sqlite"\n')).toStrictEqual([
        'gspot.toml: tools.sqlfluff.dialect: No selected configuration has the setting tools.sqlfluff.dialect. No setting exists under that table. Run `gspot list settings` to see every one.',
    ]);
    expect(validateSettingsText('[tools.commitlint]\ntypes = ["feat", "fix"]\n')).toStrictEqual([]);
});

test.each([...SCOPE_CONFIGURATION_SETTINGS])('$name', ({ text, messages }) => {
    expect(validateSettingsText(text)).toStrictEqual([...messages]);
});

test('rules.exclude accepts a rule file path and a configuration folder', () => {
    const exclude = [findRuleFilePath('engineering', 'ACCESSIBILITY.md'), `${GSPOT_PATHS.configurations}/library`];
    expect(validateSettingsText(stringify({ rules: { exclude } }))).toStrictEqual([]);
});

test('a rules.exclude entry that matches no rule file names the near match', () => {
    const misspelled = findRuleFilePath('engineering', 'ACCESSIBILITY.md').replace(/\.md$/u, '.txt');
    const near = ['ACCESSIBILITY.md', 'CLI.md', 'TESTING.md'].map(
        (file) => `\`${findRuleFilePath('engineering', file)}\``,
    );
    expect(captureThrow(() => parseSettings(stringify({ rules: { exclude: [misspelled] } }), undefined))).toBe(
        `gspot.toml: rules.exclude.0: [rules] exclude names \`${misspelled}\`, which matches no rule. Did you mean ${near.join(', ')}?`,
    );
});

test.each([...FIRST_READ.slice(0, 1), 'general/prose'])(
    'rules.exclude refuses %s, a rule file that every agent reads first',
    (ruleFile) => {
        expect(
            captureThrow(() =>
                parseSettings(
                    stringify({ rules: { exclude: [`${GSPOT_PATHS.configurations}/${ruleFile}`] } }),
                    undefined,
                ),
            ),
        ).toBe(
            `gspot.toml: rules.exclude.0: [rules] exclude names \`${GSPOT_PATHS.configurations}/${ruleFile}\`, which holds a file every agent opens first (\`general/engineering/rules/WORKING.md\`, \`general/prose/rules/WRITING.md\`, \`general/engineering/rules/TALKING.md\`). Remove the entry.`,
        );
    },
);

test('a limit looser than the default needs a reason, and a tighter one does not', () => {
    expect(
        captureThrow(() => parseSettings('configurations = ["bash"]\n[limits]\nfile_lines = 1000\n', undefined)),
    ).toBe(
        'gspot.toml: limits.file_lines: `limits.file_lines = 1000` is looser than the shipped default 300, so it needs a reason. Run: gspot set limits.file_lines 1000 --reason "<why>"',
    );
    expect(validateSettingsText('configurations = ["bash"]\n[limits]\nfile_lines = 100\n')).toStrictEqual([]);
});

test.each([...UNKNOWN_KEY_CASES])('an unknown key is refused: $name', (row) => {
    expect(() => parseSettings(row.text, undefined)).toThrow(row.message);
    expect(validateSettingsText(row.text.replace(row.correction[0], row.correction[1]))).toStrictEqual([]);
});
test('a record without a reason is refused at its reason field', () => {
    const text = 'configurations = ["bash"]\n[[ignore]]\ncheck = "bash/shellcheck"\n';
    expect(captureThrow(() => parseSettings(text, undefined))).toBe(
        'gspot.toml: ignore.0.reason: needs a reason. Add `reason = "..."` to this record.',
    );
    expect(validateSettingsText(`${text}reason = "${REVIEWED_REASON}"\n`)).toStrictEqual([]);
});

test.each([...EMPTY_REASONS])('a word with the reason "$reason" is refused', ({ reason, refused }) => {
    expect(
        captureThrow(() =>
            parseSettings(
                `configurations = ["prose"]\n[spelling]\nallowed_words = { Codex = ${JSON.stringify(reason)} }\n`,
                undefined,
            ),
        ),
    ).toBe(
        `gspot.toml: spelling.allowed_words.Codex: spelling.allowed_words.Codex needs a reason that says something: ${refused} is refused. Write one sentence saying why.`,
    );
});

test.each([...KEY_PATH_CASES])(
    'an error names the key path of $name, and the fix clears it',
    ({ text, where, correction }) => {
        const found = validateSettingsText(text);
        expect(found.map((line) => where.find((path) => line.startsWith(`gspot.toml: ${path}`)))).toStrictEqual([
            ...where,
        ]);
        expect(validateSettingsText(text.replace(correction[0], correction[1]))).toStrictEqual([]);
    },
);

test.each(['\n', '\r\n'])(
    'a TOML syntax error names its line and does not copy the source: %j line endings',
    (newline: string) => {
        const invalid = ['# private fixture marker', 'configurations = ?', ''].join(newline);
        const found = validateSettingsText(invalid);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatch(/^gspot\.toml:2:\d+ is not valid TOML:/u);
        expect(found[0]).not.toContain('private fixture marker');
        expect(found[0]).not.toContain('\n');
        expect(validateSettingsText(invalid.replace('configurations = ?', 'configurations = []'))).toStrictEqual([]);
    },
);

test('unknown configurations are refused where they are written, with a suggestion', () => {
    const errors = validateSettingsText(
        buildSandboxSettings(['bas', 'bash', 'bas'], {
            rules: true,
            scopes: [{ path: 'api', configurations: ['pythonn', 'bas'] }],
        }),
    );
    const suggestion = 'Run `gspot list configurations` to see the available configurations.';
    expect(errors).toStrictEqual([
        `gspot.toml: configurations.0: There is no configuration called \`bas\`. Did you mean \`bash\`, \`css\`, \`supabase\`? ${suggestion}`,
        `gspot.toml: configurations.2: There is no configuration called \`bas\`. Did you mean \`bash\`, \`css\`, \`supabase\`? ${suggestion}`,
        `gspot.toml: scope.0.configurations.0: There is no configuration called \`pythonn\`. Did you mean \`python\`? ${suggestion}`,
        `gspot.toml: scope.0.configurations.1: There is no configuration called \`bas\`. Did you mean \`bash\`, \`css\`, \`supabase\`? ${suggestion}`,
    ]);
});

test('a scope path through a link to a folder outside the repository is refused', async () => {
    await using sandbox = await testdir({ 'project/.keep': '', 'outside/nested/sentinel': 'unchanged' });

    const root = join(sandbox.path, 'project');
    await symlink('../outside', join(root, 'linked'));
    const found = validateSettingsText(
        buildSandboxSettings(['bash'], { rules: true, scopes: [{ path: 'linked' }] }),
        root,
    );
    expect(found).toStrictEqual(['gspot.toml: scope.linked: linked is a link. gspot does not write through links.']);
});

test('a Semgrep rule file or a scope plugin module that names no file is refused at its key', async () => {
    await using sandbox = await testdir({ 'present.mjs': 'export default {};', 'present.yml': 'rules: []' });
    const text = stringify(RULE_FILE_SETTINGS);
    expect(validateSettingsText(text, sandbox.path)).toStrictEqual([...RULE_FILE_ERRORS]);
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
                tools: {
                    eslint: { plugins: [{ name: 'local', path: 'local.mjs', rules: {} }] },
                    semgrep: { rule_files: ['local.mjs'] },
                },
            }),
            root,
        ),
    ).toStrictEqual([
        'gspot.toml: tools.eslint.plugins.0.path: local.mjs is a link. Point path at a tracked file.',
        'gspot.toml: tools.semgrep.rule_files.0: local.mjs is a link. Point rule_files at a tracked file.',
    ]);
});
