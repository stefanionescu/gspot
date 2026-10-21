import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { stringify } from '@decimalturn/toml-patch';
import { getTable } from '#cli/settings/scope-view.ts';
import { matchSubstring } from '#tests/setup/matchers.ts';
import { FIRST_READ } from '#cli/config/generation/rules.ts';

import {
    parseSettingsText,
    buildSandboxSettings,
    validateSettingsText,
    buildRootScopeSettings,
} from '#tests/setup/settings.ts';
import {
    KEY_PATH_CASES,
    REVIEWED_REASON,
    RULE_FILE_ERRORS,
    UNKNOWN_KEY_CASES,
    RULE_FILE_SETTINGS,
} from '#tests/data/settings/errors.ts';

test('a file path and a category folder are accepted', () => {
    expect(() =>
        parseSettingsText(
            '[rules]\nexclude = [".gspot/configurations/general/engineering/rules/ACCESSIBILITY.md", ".gspot/configurations/library"]\n',
        ),
    ).not.toThrow();
});

test('an entry that matches no rule file names the near match', () => {
    expect(() =>
        parseSettingsText('[rules]\nexclude = [".gspot/configurations/general/engineering/rules/ACCESIBILITY.md"]\n'),
    ).toThrow('ACCESSIBILITY.md');
});

test.each([...FIRST_READ.slice(0, 1), 'general/prose'])('a first-read entry %s cannot be left out', (entry) => {
    expect(() => parseSettingsText(`[rules]\nexclude = [".gspot/configurations/${entry}"]\n`)).toThrow(
        'every agent opens first',
    );
});

test('a limit looser than the default needs a reason, and a tighter one does not', () => {
    expect(() => parseSettingsText('configurations = ["bash"]\n[limits]\nfile_lines = 1000\n')).toThrow('reason');
    expect(() => parseSettingsText('configurations = ["bash"]\n[limits]\nfile_lines = 100\n')).not.toThrow();
});

test.each([...UNKNOWN_KEY_CASES])('an unknown key is refused: $name', (row) => {
    expect(() => parseSettingsText(row.text)).toThrow(row.message);
    expect(() => parseSettingsText(row.text.replace(row.correction[0], row.correction[1]))).not.toThrow();
});

test('a rule option named reason is passed on and is not a gspot reason', () => {
    const settings = parseSettingsText(
        'configurations = ["css"]\n[tools.stylelint.rules]\nselector-class-pattern = ["^[a-z]+$", { reason = false }]\n',
    );
    const rules: unknown = getTable(buildRootScopeSettings(settings), 'tools.stylelint').rules;
    expect(rules).toStrictEqual({ 'selector-class-pattern': ['^[a-z]+$', { reason: false }] });
});

test('a record without a reason is refused at its reason field', () => {
    const text = 'configurations = ["bash"]\n[[ignore]]\ncheck = "bash/shellcheck"\n';
    expect(() => parseSettingsText(text)).toThrow('ignore.0.reason:');
    expect(() => parseSettingsText(text + `reason = "${REVIEWED_REASON}"\n`)).not.toThrow();
});

test.each(['', 'because', 'Codex'])('a word with the reason %s is refused', (reason) => {
    expect(() =>
        parseSettingsText(`configurations = ["prose"]\nallowed_words = { Codex = ${JSON.stringify(reason)} }\n`),
    ).toThrow('allowed_words.Codex needs a reason');
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
    expect(errors).toStrictEqual([
        matchSubstring('gspot.toml: configurations.0: There is no configuration called `bas`.'),
        matchSubstring('gspot.toml: configurations.2: There is no configuration called `bas`.'),
        matchSubstring('gspot.toml: scope.0.configurations.0: There is no configuration called `pythonn`.'),
        matchSubstring('gspot.toml: scope.0.configurations.1: There is no configuration called `bas`.'),
    ]);
    expect(errors[0]).toContain('Did you mean');
    expect(errors[0]).toContain('`bash`');
    expect(errors[2]).toContain('`python`');
});

test('a scope path through a link to a folder outside the repository is refused', async () => {
    await using sandbox = await testdir({ 'project/.keep': '', 'outside/nested/sentinel': 'unchanged' });

    const root = join(sandbox.path, 'project');
    await symlink('../outside', join(root, 'linked'));
    const found = validateSettingsText(
        buildSandboxSettings(['bash'], { rules: true, scopes: [{ path: 'linked' }] }),
        root,
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('linked is a link. gspot does not write through links.');
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
