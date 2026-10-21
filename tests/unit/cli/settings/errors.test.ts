import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { symlink } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { FIRST_READ } from '#cli/config/rules.ts';
import { stringify } from '@decimalturn/toml-patch';
import { parseSettings } from '#cli/settings/read.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { getTable, buildScopeView } from '#cli/settings/scope-view.ts';
import { matchSubstring, captureRejection } from '#tests/setup/matchers.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/settings.ts';

import {
    KEY_PATH_CASES,
    REVIEWED_REASON,
    RULE_FILE_ERRORS,
    UNKNOWN_KEY_CASES,
    RULE_FILE_SETTINGS,
} from '#tests/data/settings/errors.ts';

test('a file path and a category folder are accepted', () => {
    expect(() =>
        parseSettings(
            '[rules]\nexclude = [".gspot/configurations/general/engineering/rules/ACCESSIBILITY.md", ".gspot/configurations/library"]\n',
            undefined,
        ),
    ).not.toThrow();
});

test('an entry that matches no rule file names the near match', () => {
    expect(() =>
        parseSettings(
            '[rules]\nexclude = [".gspot/configurations/general/engineering/rules/ACCESIBILITY.md"]\n',
            undefined,
        ),
    ).toThrow('ACCESSIBILITY.md');
});

test.each([...FIRST_READ.slice(0, 1), 'general/prose'])('a first-read entry %s cannot be left out', (entry) => {
    expect(() => parseSettings(`[rules]\nexclude = [".gspot/configurations/${entry}"]\n`, undefined)).toThrow(
        'every agent opens first',
    );
});

test('a limit looser than the default needs a reason, and a tighter one does not', () => {
    expect(() => parseSettings('configurations = ["bash"]\n[limits]\nfile_lines = 1000\n', undefined)).toThrow(
        'reason',
    );
    expect(() => parseSettings('configurations = ["bash"]\n[limits]\nfile_lines = 100\n', undefined)).not.toThrow();
});

test.each([...UNKNOWN_KEY_CASES])('an unknown key is refused: $name', (row) => {
    expect(() => parseSettings(row.text, undefined)).toThrow(row.message);
    expect(() => parseSettings(row.text.replace(row.correction[0], row.correction[1]), undefined)).not.toThrow();
});

test('a rule option named reason is passed on and is not a gspot reason', () => {
    const settings = parseSettings(
        'configurations = ["css"]\n[tools.stylelint.rules]\nselector-class-pattern = ["^[a-z]+$", { reason = false }]\n',
        undefined,
    );
    const selected = selectForScope(settings, '', readManifests());
    const rules: unknown = getTable(
        buildScopeView(buildKnownSettings(selected, 'recommended'), settings, selected, ''),
        'tools.stylelint',
    ).rules;
    expect(rules).toStrictEqual({ 'selector-class-pattern': ['^[a-z]+$', { reason: false }] });
});

test('a record without a reason is refused at its reason field', () => {
    const text = 'configurations = ["bash"]\n[[ignore]]\ncheck = "bash/shellcheck"\n';
    expect(() => parseSettings(text, undefined)).toThrow('ignore.0.reason:');
    expect(() => parseSettings(text + `reason = "${REVIEWED_REASON}"\n`, undefined)).not.toThrow();
});

test.each(['', 'because', 'Codex'])('a word with the reason %s is refused', (reason) => {
    expect(() =>
        parseSettings(`configurations = ["prose"]\nallowed_words = { Codex = ${JSON.stringify(reason)} }\n`, undefined),
    ).toThrow('allowed_words.Codex needs a reason');
});

test('an OSV ignore expiry cannot add a TOML table', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['dependencies'], {
            rules: true,
            tables: stringify({
                ignore: [
                    {
                        check: 'dependencies/osv-scanner',
                        rule: 'GHSA-example',
                        reason: 'Reviewed upstream.',
                        until: '2026-09-20\n[verbatim]\ninjected = true',
                    },
                ],
            }),
        }),
    });

    expect(await captureRejection(openSession(sandbox.path))).toContain('ignore.0.until');
});

test.each([
    ...KEY_PATH_CASES,
    ...[
        {
            correction: ['paths = []', 'paths = ["src"]'] as const,
            where: ['tools.eslint.override.0.paths:'],
            source: 'paths = []\nrules = {eqeqeq = ["always"]}',
        },
        {
            correction: ['eqeqeq = 0', 'eqeqeq = ["always"]'] as const,
            where: ['tools.eslint.override.0.rules.eqeqeq:'],
            source: 'paths = ["src"]\nrules = {eqeqeq = 0}',
        },
        {
            correction: ['eqeqeq = true', 'eqeqeq = ["always"]'] as const,
            where: ['tools.eslint.override.0.rules.eqeqeq:'],
            source: 'paths = ["src"]\nrules = {eqeqeq = true}',
        },
        {
            correction: ['rulez', 'rules'] as const,
            where: ['[tools.eslint.override.0]: `rulez` is not a gspot.toml setting.'],
            source: 'paths = ["src"]\nrulez = {eqeqeq = ["always"]}',
        },
    ].map(({ source, correction, where }) => ({
        name: where.join(', '),
        text: buildSandboxSettings(['javascript'], { rules: true, tables: `[[tools.eslint.override]]\n${source}\n` }),
        where,
        correction,
        messages: [],
    })),
])('an error names the key path of $name, and the fix clears it', ({ text, where, correction, messages }) => {
    const found = validateSettingsText(text);
    expect(found.every((line) => where.some((path) => line.startsWith(`gspot.toml: ${path}`)))).toBe(true);
    for (const path of where) {
        expect(found.some((line) => line.startsWith(`gspot.toml: ${path}`))).toBe(true);
    }
    for (const message of messages) expect(found[0]).toContain(message);
    expect(validateSettingsText(text.replace(correction[0], correction[1]))).toStrictEqual([]);
});

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
