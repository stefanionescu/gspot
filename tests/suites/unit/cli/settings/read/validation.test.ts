import { symlink } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { FIRST_READ } from '#cli/config/settings/validation.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import {
    DUPLICATED_REASON_ERRORS,
    EMPTY_REASONS,
    INVALID_LICENSES,
    INVALID_MARKDOWNLINT_NAMES,
    KEY_PATH_CASES,
    REVIEWED_REASON,
    RULE_FILE_ERRORS,
    RULE_FILE_SETTINGS,
    RULE_OPTION_REASON_TABLES,
    SCOPE_CONFIGURATION_SETTINGS,
    VALID_LICENSES,
} from '#tests/config/settings/read.ts';
import { EMPTY_DEFAULT_SOURCE } from '#tests/config/setup/languages.ts';
import { getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test.each([...RULE_OPTION_REASON_TABLES])(
    'a reason option in $name rules belongs to the lint rule',
    async ({ tables }) => {
        await using sandbox = await testdir({ 'local.mjs': EMPTY_DEFAULT_SOURCE });
        expect(validateSettingsText(buildSandboxSettings(['javascript'], { tables }), sandbox.path)).toStrictEqual([]);
    },
);

test.each(INVALID_MARKDOWNLINT_NAMES)('markdownlint refuses $name at its rule key', ({ name, value }) => {
    expect(
        validateSettingsText(
            stringify({ configurations: ['markdown'], tools: { markdownlint: { rules: { [name]: value } } } }),
        ),
    ).toStrictEqual([
        `gspot.toml:4: tools.markdownlint.rules.${name}: Name a rule by its ID, such as MD024 = { siblings_only = false }. This table holds rule options only.`,
    ]);
});

function buildVendorPrefixSettings(ignoreProperties: string[]): string {
    return stringify({
        configurations: ['css'],
        tools: { stylelint: { rules: { 'property-no-vendor-prefix': [true, { ignoreProperties }] } } },
    });
}

test('property-no-vendor-prefix refuses an ignored property with no prefix, and accepts a prefixed name and a pattern', () => {
    expect(
        validateSettingsText(buildVendorPrefixSettings(['-webkit-backdrop-filter', 'text-size-adjust'])),
    ).toStrictEqual([
        'gspot.toml:4: tools.stylelint.rules.property-no-vendor-prefix.1.ignoreProperties.1: Stylelint matches text-size-adjust against the property as written, so it ignores nothing. Write the prefixed name, such as -webkit-text-size-adjust.',
    ]);
    expect(
        validateSettingsText(buildVendorPrefixSettings(['-webkit-backdrop-filter', '/text-size-adjust$/'])),
    ).toStrictEqual([]);
});

test.each([...DUPLICATED_REASON_ERRORS])('an invalid $key reason is reported once', ({ text, where }) => {
    expect(validateSettingsText(buildSandboxSettings(['bash', 'docs'], { tables: text }))).toStrictEqual([where]);
});

test.each(INVALID_LICENSES)('licenses.allowed refuses %s before running a check', (license) => {
    expect(
        validateSettingsText(stringify({ configurations: ['licenses'], licenses: { allowed: [license] } })),
    ).toStrictEqual([
        `gspot.toml:4: licenses.allowed.0: The value ${JSON.stringify(license)} is not valid for licenses.allowed.0. Use one SPDX license ID, such as MIT or Apache-2.0, not an AND or OR expression.`,
    ]);
});

test.each(VALID_LICENSES)('licenses.allowed accepts one SPDX license: %s', (license) => {
    expect(
        validateSettingsText(stringify({ configurations: ['licenses'], licenses: { allowed: [license] } })),
    ).toStrictEqual([]);
});

test('a licenses table with no licenses configuration stops with the command that adds it', () => {
    const text = '[licenses]\nallowed = ["MIT"]\n';
    expect(validateSettingsText(text)).toStrictEqual([
        'gspot.toml:2: licenses.allowed: licenses.allowed belongs to licenses, which no scope selects. Run gspot add licenses.',
    ]);
    expect(validateSettingsText(`configurations = ["licenses"]\n${text}`)).toStrictEqual([]);
});

test('two import rules cannot share a name', () => {
    const lower = { name: 'lower', paths: ['lower/**'], can_import: [] };
    const upper = { name: 'lower', paths: ['upper/**'], can_import: ['lower'] };
    expect(validateSettingsText(stringify({ import_rule: [lower, upper] }))).toStrictEqual([
        'gspot.toml:7: import_rule.1.name: Two [[import_rule]] records name lower. Keep one.',
    ]);
    expect(validateSettingsText(stringify({ import_rule: [lower, { ...upper, name: 'upper' }] }))).toStrictEqual([]);
});

test('the release age can be written at the root and cannot be written in a scope', () => {
    expect(validateSettingsText('[dependencies]\nmin_release_age_days = 30\n')).toStrictEqual([]);
    expect(
        validateSettingsText('[[scope]]\npath = "api"\n[scope.dependencies]\nmin_release_age_days = 30\n'),
    ).toStrictEqual([
        'gspot.toml:4: scope.0.dependencies.min_release_age_days: There is no setting called dependencies.min_release_age_days. The settings that exist under that table are dependencies.allowed_registries, dependencies.bun_scanner.',
    ]);
});

test.each([
    {
        text: '[ci]\nenable = true\n',
        where: 'gspot.toml:2: ci.enable: There is no setting called ci.enable. Did you mean ci.enabled? The settings that exist under that table are ci.enabled, ci.provider, ci.setup_command, ci.operating_systems, ci.linux_runner.',
    },
    {
        text: '[tools.markdownlnt]\nrules = {}\n',
        where: 'gspot.toml:1: tools.markdownlnt: There is no tools.markdownlnt table. Did you mean markdownlint? The tools tables are eslint, ruff, commitlint, markdownlint, stylelint.',
    },
])('an unknown key under $text names the closest key or table that exists', ({ text, where }) => {
    expect(validateSettingsText(text)).toStrictEqual([where]);
});

test.each([...SCOPE_CONFIGURATION_SETTINGS])('$name', ({ text, errors }) => {
    expect(validateSettingsText(text)).toStrictEqual([...errors]);
});

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
            `gspot.toml:2: rule_files.exclude.0: [rule_files] exclude names ${ruleFile}, which holds a file every agent opens first (WORKING.md, WRITING.md). Remove the entry.`,
        ]);
    },
);

test('a limit looser than the default needs a reason, and a tighter one does not', () => {
    const looser = 'configurations = ["bash"]\n[limits]\nmax_file_lines = 1000\n';
    expect(validateSettingsText(looser)).toStrictEqual([
        'gspot.toml:3: limits.max_file_lines: 1000 is weaker than the shipped default 300, so it needs a reason. Write limits.max_file_lines = { value = 1000, reason = "<why>" }.',
    ]);
    expect(validateSettingsText('configurations = ["bash"]\n[limits]\nmax_file_lines = 100\n')).toStrictEqual([]);
});

test('an ignore of ansible/ansible-lint-production is refused and names ansible/ansible-lint', () => {
    const text = `configurations = ["ansible"]\n[[ignore]]\ncheck = "ansible/ansible-lint-production"\nreason = "${REVIEWED_REASON}"\n`;
    expect(validateSettingsText(text)).toStrictEqual([
        'gspot.toml:3: ignore.0.check: There is no check called ansible/ansible-lint-production. Did you mean ansible/ansible-lint?',
    ]);
});

test('a record without a reason is refused at its reason field', () => {
    const text = 'configurations = ["bash"]\n[[ignore]]\ncheck = "bash/shellcheck"\n';
    expect(validateSettingsText(text)).toStrictEqual([
        'gspot.toml:2: ignore.0.reason: needs a reason. Add reason = "..." to this record.',
    ]);
    expect(validateSettingsText(`${text}reason = "${REVIEWED_REASON}"\n`)).toStrictEqual([]);
});

test.each([...EMPTY_REASONS])('a word with the reason $reason is refused', ({ reason, refusal }) => {
    expect(
        validateSettingsText(
            `configurations = ["prose"]\n[spelling]\nallowed_words = { Codex = ${JSON.stringify(reason)} }\n`,
        ),
    ).toStrictEqual([
        `gspot.toml:3: spelling.allowed_words.Codex: spelling.allowed_words.Codex needs a reason of two or more words that says why: ${refusal}.`,
    ]);
});

test.each([...KEY_PATH_CASES])(
    'an error names the key path of $name, and the fix clears it',
    ({ configurations, options, where, correction }) => {
        const text = buildSandboxSettings(configurations, options);
        expect(validateSettingsText(text)).toStrictEqual([...where]);
        expect(validateSettingsText(text.replace(correction[0], () => correction[1]))).toStrictEqual([]);
    },
);

test('an error names the line of a value inside a multiline array, and the fix clears it', () => {
    const text = 'configurations = [\n"bash",\n12\n]\n';
    expect(validateSettingsText(text)).toStrictEqual([
        'gspot.toml:3: configurations.1: The value 12 is not valid for configurations.1. Use a valid string value.',
    ]);
    expect(validateSettingsText(text.replace('12', '"yaml"'))).toStrictEqual([]);
});

test.each(['\n', '\r\n'])(
    'a TOML syntax error names its line and does not copy the source: %j line endings',
    (newline: string) => {
        const invalid = ['# private sample marker', 'configurations = ?', ''].join(newline);
        using sandbox = createTemporaryFolder();
        expect(() => parseSettings(invalid, sandbox.path)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'parse',
                message: expect.stringContaining('gspot.toml:2:18') as string,
            }),
        );
        expect(() => parseSettings(invalid, sandbox.path)).not.toThrow('private sample marker');
        expect(validateSettingsText(invalid.replace('configurations = ?', 'configurations = []'))).toStrictEqual([]);
    },
);

test('unknown configurations are refused where they are written, with a suggestion', () => {
    const text = buildSandboxSettings(['bas', 'bash', 'bas'], {
        rules: true,
        scopes: [{ path: 'api', configurations: ['pythonn', 'bas'] }],
    });
    const list = 'See https://generativespotting.com/reference/configurations/ for the available configurations.';
    expect(validateSettingsText(text)).toStrictEqual([
        `gspot.toml:1: configurations.0: There is no configuration called bas. Did you mean bash, supabase? ${list}`,
        `gspot.toml:1: configurations.2: There is no configuration called bas. Did you mean bash, supabase? ${list}`,
        `gspot.toml:5: scope.0.configurations.0: There is no configuration called pythonn. Did you mean python? ${list}`,
        `gspot.toml:5: scope.0.configurations.1: There is no configuration called bas. Did you mean bash, supabase? ${list}`,
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

test('tool settings reject an unknown docker value', () => {
    expect(
        validateSettingsText(buildSandboxSettings(['docker'], { tables: '[docker]\nseverity = ["SEVERE"]\n' })),
    ).toStrictEqual([
        'gspot.toml:3: docker.severity.0: The value "SEVERE" is not valid for docker.severity.0. Use UNKNOWN, LOW, MEDIUM, HIGH, or CRITICAL.',
    ]);
});
