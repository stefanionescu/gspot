import { test, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { readSettings } from '#cli/settings/read.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { findSetting, getSettingValue } from '#cli/settings/inherit.ts';
import { CSS_HTML_NAMING_SETTINGS } from '#tests/config/settings/inherit.ts';
import { buildSandboxSettings, buildSelectedAvailableSettings } from '#tests/setup/cli/settings.ts';

test('[naming.css] and [naming.html.folders] accept max_words, max_characters, and cases', () => {
    using sandbox = createTemporaryFolder();
    const settings = readSettings(CSS_HTML_NAMING_SETTINGS, sandbox.path);
    const availableSettings = buildSelectedAvailableSettings(['css', 'html', 'naming']);
    const namingRules = { max_words: 3, max_characters: 20, cases: ['kebab'] };
    for (const table of ['naming.css', 'naming.css.files', 'naming.html.folders']) {
        for (const [name, value] of Object.entries(namingRules)) {
            expect(getSettingValue(availableSettings, settings, `${table}.${name}`, '')?.value).toStrictEqual(value);
        }
    }
    expect(findSetting(availableSettings, 'naming.css.functions.max_words')).toBeUndefined();
    expect(findSetting(availableSettings, 'naming.html.types.max_characters')).toBeUndefined();
});

test('a per-language key maps to its base setting', () => {
    const baseSettings = buildSelectedAvailableSettings(['structure', 'bash', 'naming', 'format', 'prose']);

    expect(findSetting(baseSettings, 'limits.bash.function_lines')?.setting.name).toBe('limits.function_lines');
    expect(findSetting(baseSettings, 'limits.python.file_lines')?.language).toBe('python');
    expect(findSetting(baseSettings, 'naming.python.parameters.max_words')?.category).toBe('parameters');
    expect(findSetting(baseSettings, 'limits.nope')).toBeUndefined();
});

test('naming cases equal to the shipped default need no reason, and other cases do', () => {
    const text = buildSandboxSettings(['typescript'], { tables: '[naming.typescript.files]\n cases = ["kebab"]\n' });
    readSettings(text, process.cwd());
    expect(() => readSettings(text.replace('["kebab"]', '["camel"]'), process.cwd())).toThrow(
        new GspotError(
            'settings',
            'gspot.toml:4: naming.typescript.files.cases.reason: naming.typescript.files.cases needs a reason. Write it as naming.typescript.files.cases = { value = [...], reason = "..." }, or run gspot set naming.typescript.files.cases ... --reason "<why>".',
        ),
    );
});
