import { test, expect } from 'bun:test';
import { parseSettings } from '#cli/settings/parse.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { createTemporaryFolder } from '#cli/system/files/temporary.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';
import { KEY_PATH_CASES, INVALID_SETTING_LOCATIONS } from '#tests/config/settings/validation.ts';

test.each([...KEY_PATH_CASES])(
    'an error names the key path of $name, and the fix clears it',
    ({ configurations, options, correction, start }) => {
        const text = buildSandboxSettings(configurations, options);
        const errors = validateSettingsText(text);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toStartWith(start);
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

test.each([...INVALID_SETTING_LOCATIONS])('settings errors locate $name', ({ text, start }) => {
    const errors = validateSettingsText(text);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toStartWith(start);
});
