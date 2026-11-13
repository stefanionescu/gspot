import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { parseSettings } from '#cli/settings/parse.ts';
import type { GspotError } from '#cli/system/errors.ts';
import {
    DUPLICATED_REASON_ERRORS,
    EMPTY_REASONS,
    REVIEWED_REASON,
    RULE_OPTION_REASON_TABLES,
} from '#tests/config/settings/parse.ts';
import { SWIFT_TARGET_REASON_CASES } from '#tests/config/settings/validation.ts';
import { EMPTY_DEFAULT_SOURCE } from '#tests/config/setup/languages.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test.each([...RULE_OPTION_REASON_TABLES])(
    'a reason option in $name rules belongs to the lint rule',
    async ({ tables }) => {
        await using sandbox = await testdir({ 'local.mjs': EMPTY_DEFAULT_SOURCE });
        expect(validateSettingsText(buildSandboxSettings(['javascript'], { tables }), sandbox.path)).toStrictEqual([]);
    },
);

test.each([...DUPLICATED_REASON_ERRORS])('an invalid $key reason is reported once', ({ key, text }) => {
    const errors = validateSettingsText(buildSandboxSettings(['bash', 'docs'], { tables: text }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toStartWith(`gspot.toml:3: ${key}.reason:`);
});

test('a limit looser than the default needs a reason, and a tighter one does not', () => {
    const looser = 'configurations = ["bash"]\n[limits]\nmax_file_lines = 1000\n';
    const errors = validateSettingsText(looser);
    expect(errors).toStrictEqual([expect.stringContaining('so it needs a reason') as string]);
    expect(errors[0]).toStartWith('gspot.toml:3: limits.max_file_lines:');
    expect(validateSettingsText('configurations = ["bash"]\n[limits]\nmax_file_lines = 100\n')).toStrictEqual([]);
});

test('a record without a reason is refused at its reason field', () => {
    const text = 'configurations = ["bash"]\n[[ignore]]\ncheck = "bash/shellcheck"\n';
    expect(validateSettingsText(text)).toStrictEqual([
        'gspot.toml:2: ignore.0.reason: needs a reason. Add reason = "..." to this record.',
    ]);
    expect(validateSettingsText(`${text}reason = "${REVIEWED_REASON}"\n`)).toStrictEqual([]);
});

test.each([...EMPTY_REASONS])('a word with the reason %j is refused', (reason) => {
    const errors = validateSettingsText(
        `configurations = ["prose"]\n[spelling]\nallowed_words = { Codex = ${JSON.stringify(reason)} }\n`,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toStartWith('gspot.toml:3: spelling.allowed_words.Codex:');
});

test.each(SWIFT_TARGET_REASON_CASES)('a Swift target validates $name', ({ lines, reason, errors }) => {
    const text = `configurations = ["swift"]\n[coverage]\nmin_line_percent = 80\n[[coverage.swift_target]]\nname = "App"\nmin_line_percent = ${String(lines)}${reason}\n`;
    expect(validateSettingsText(text)).toStrictEqual([...errors]);
});

test('naming cases equal to the shipped default need no reason, and other cases do', () => {
    const text = buildSandboxSettings(['typescript'], { tables: '[naming.typescript.files]\n cases = ["kebab"]\n' });
    parseSettings(text, process.cwd());
    expect(() => parseSettings(text.replace('["kebab"]', '["camel"]'), process.cwd())).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'settings',
            message: expect.stringContaining('gspot.toml:3: naming.typescript.files.cases.reason') as string,
        }),
    );
});
