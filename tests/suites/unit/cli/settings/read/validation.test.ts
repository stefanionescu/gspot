import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { stringify } from '@decimalturn/toml-patch';
import { readSettings } from '#cli/settings/read.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { FIRST_READ } from '#cli/config/settings/validation.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { getRuleFilePath } from '#tests/setup/cli/generated-files.ts';
import { EMPTY_DEFAULT_SOURCE } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';

import {
    EMPTY_REASONS,
    VALID_LICENSES,
    KEY_PATH_CASES,
    REVIEWED_REASON,
    INVALID_LICENSES,
    RULE_FILE_ERRORS,
    UNKNOWN_KEY_CASES,
    INVALID_TOOL_ENUMS,
    RULE_FILE_SETTINGS,
    DUPLICATED_REASON_ERRORS,
    RULE_OPTION_REASON_TABLES,
    INVALID_MARKDOWNLINT_NAMES,
    SCOPE_CONFIGURATION_SETTINGS,
} from '#tests/config/settings/read.ts';

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
    ).toStrictEqual([`gspot.toml:4: tools.markdownlint.rules.${name}`]);
});

test.each([...DUPLICATED_REASON_ERRORS])('an invalid $key reason is reported once', ({ text, where }) => {
    expect(validateSettingsText(buildSandboxSettings(['bash', 'docs'], { tables: text }))).toStrictEqual([where]);
});

test.each(INVALID_LICENSES)('licenses.allowed refuses %s before running a check', (license) => {
    expect(validateSettingsText(stringify({ licenses: { allowed: [license] } }))).toStrictEqual([
        'gspot.toml:2: licenses.allowed.0',
    ]);
});

test.each(VALID_LICENSES)('licenses.allowed accepts one SPDX license: %s', (license) => {
    expect(validateSettingsText(stringify({ licenses: { allowed: [license] } }))).toStrictEqual([]);
});

test('two import rules cannot share a name', () => {
    const lower = { name: 'lower', paths: ['lower/**'], can_import: [] };
    const upper = { name: 'lower', paths: ['upper/**'], can_import: ['lower'] };
    expect(validateSettingsText(stringify({ import_rule: [lower, upper] }))).toStrictEqual([
        'gspot.toml:7: import_rule.1.name',
    ]);
    expect(validateSettingsText(stringify({ import_rule: [lower, { ...upper, name: 'upper' }] }))).toStrictEqual([]);
});

test('the release age can be written at the root and cannot be written in a scope', () => {
    expect(validateSettingsText('[dependencies]\nmin_release_age_days = 30\n')).toStrictEqual([]);
    expect(
        validateSettingsText('[[scope]]\npath = "api"\n[scope.dependencies]\nmin_release_age_days = 30\n'),
    ).toStrictEqual(['gspot.toml:4: scope.0.dependencies.min_release_age_days']);
});

test.each([
    { text: '[ci]\nenable = true\n', where: 'gspot.toml:2: ci.enable', nearest: 'enabled' },
    { text: '[tools.markdownlnt]\nrules = {}\n', where: 'gspot.toml:1: tools.markdownlnt', nearest: 'markdownlint' },
])('an unknown key under $text names the closest key or table that exists', ({ text, where, nearest }) => {
    using sandbox = createTemporaryFolder();
    expect(validateSettingsText(text)).toStrictEqual([where]);
    expect(() => readSettings(text, sandbox.path)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'settings',
            message: expect.stringContaining(nearest) as string,
        }),
    );
});

test('settings of an unselected language are refused while settings of automatic general configurations stay valid', () => {
    expect(validateSettingsText('configurations = ["bash"]\n[sql]\ndialect = "sqlite"\n')).toStrictEqual([
        'gspot.toml:3: sql.dialect',
    ]);
    expect(validateSettingsText('[commits]\ntypes = ["feat", "fix"]\n')).toStrictEqual([]);
});

test.each([...SCOPE_CONFIGURATION_SETTINGS])('$name', ({ text, errors }) => {
    expect(validateSettingsText(text)).toStrictEqual([...errors]);
});

test('rule_files.exclude accepts a rule file path', () => {
    const exclude = [getRuleFilePath('engineering', 'ACCESSIBILITY.md')];
    expect(validateSettingsText(stringify({ rule_files: { exclude } }))).toStrictEqual([]);
});

test('a rule_files.exclude path that matches no rule file names the near match', () => {
    using sandbox = createTemporaryFolder();
    const misspelled = getRuleFilePath('engineering', 'ACCESSIBILITY.md').replace(/\.md$/u, '.txt');
    const near = getRuleFilePath('engineering', 'ACCESSIBILITY.md');
    expect(() => readSettings(stringify({ rule_files: { exclude: [misspelled] } }), sandbox.path)).toThrow(
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
            'gspot.toml:2: rule_files.exclude.0',
        ]);
    },
);

test('a limit looser than the default needs a reason, and a tighter one does not', () => {
    using sandbox = createTemporaryFolder();
    const looser = 'configurations = ["bash"]\n[limits]\nmax_file_lines = 1000\n';
    expect(validateSettingsText(looser)).toStrictEqual(['gspot.toml:3: limits.max_file_lines']);
    expect(() => readSettings(looser, sandbox.path)).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'settings',
            message: expect.stringContaining('gspot set limits.max_file_lines 1000 --reason') as string,
        }),
    );
    expect(validateSettingsText('configurations = ["bash"]\n[limits]\nmax_file_lines = 100\n')).toStrictEqual([]);
});

test.each([...UNKNOWN_KEY_CASES])('an unknown key is refused: $name', (row) => {
    using sandbox = createTemporaryFolder();
    expect(validateSettingsText(row.text)).toStrictEqual([row.where]);
    expect(() => readSettings(row.text, sandbox.path)).toThrow(new RegExp(String.raw`\b${row.correction[1]}\b`, 'u'));
    expect(validateSettingsText(row.text.replace(row.correction[0], () => row.correction[1]))).toStrictEqual([]);
});

test('a record without a reason is refused at its reason field', () => {
    const text = 'configurations = ["bash"]\n[[ignore]]\ncheck = "bash/shellcheck"\n';
    expect(validateSettingsText(text)).toStrictEqual(['gspot.toml:2: ignore.0.reason']);
    expect(validateSettingsText(`${text}reason = "${REVIEWED_REASON}"\n`)).toStrictEqual([]);
});

test.each([...EMPTY_REASONS])('a word with the reason %j is refused', (reason) => {
    expect(
        validateSettingsText(
            `configurations = ["prose"]\n[spelling]\nallowed_words = { Codex = ${JSON.stringify(reason)} }\n`,
        ),
    ).toStrictEqual(['gspot.toml:3: spelling.allowed_words.Codex']);
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
    expect(validateSettingsText(text)).toStrictEqual(['gspot.toml:3: configurations.1']);
    expect(validateSettingsText(text.replace('12', '"data-files"'))).toStrictEqual([]);
});

test.each(['\n', '\r\n'])(
    'a TOML syntax error names its line and does not copy the source: %j line endings',
    (newline: string) => {
        const invalid = ['# private sample marker', 'configurations = ?', ''].join(newline);
        using sandbox = createTemporaryFolder();
        expect(() => readSettings(invalid, sandbox.path)).toThrow(
            matchFields<GspotError>({
                name: 'GspotError',
                code: 'parse',
                message: expect.stringContaining('gspot.toml:2:18') as string,
            }),
        );
        expect(() => readSettings(invalid, sandbox.path)).not.toThrow('private sample marker');
        expect(validateSettingsText(invalid.replace('configurations = ?', 'configurations = []'))).toStrictEqual([]);
    },
);

test('unknown configurations are refused where they are written, with a suggestion', () => {
    using sandbox = createTemporaryFolder();
    const text = buildSandboxSettings(['bas', 'bash', 'bas'], {
        rules: true,
        scopes: [{ path: 'api', configurations: ['pythonn', 'bas'] }],
    });
    expect(validateSettingsText(text)).toStrictEqual([
        'gspot.toml:1: configurations.0',
        'gspot.toml:1: configurations.2',
        'gspot.toml:5: scope.0.configurations.0',
        'gspot.toml:5: scope.0.configurations.1',
    ]);
    expect(() => readSettings(text, sandbox.path)).toThrow(/\bpython\b/u);
});

test('a scope path through a link to a folder outside the repository is refused', async () => {
    await using sandbox = await testdir({ 'project/.keep': '', 'outside/nested/sentinel': 'unchanged' });

    const root = join(sandbox.path, 'project');
    await symlink('../outside', join(root, 'linked'));
    const found = validateSettingsText(
        buildSandboxSettings(['bash'], { rules: true, scopes: [{ path: 'linked' }] }),
        root,
    );
    expect(found).toStrictEqual(['gspot.toml:4: scope.0.path']);
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
    ).toStrictEqual(['gspot.toml:4: tools.eslint.plugins.0.path', 'gspot.toml:7: security.semgrep_rules.0']);
});

test.each([...INVALID_TOOL_ENUMS])(
    'tool settings reject an unknown $configuration value',
    ({ configuration, tables, where }) => {
        expect(validateSettingsText(buildSandboxSettings([configuration], { tables }))).toStrictEqual([where]);
    },
);
