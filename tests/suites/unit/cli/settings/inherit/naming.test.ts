import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readSettings } from '#cli/settings/read.ts';
import { openSession } from '#cli/planning/session.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { findSetting, getSettingValue } from '#cli/settings/inherit.ts';
import { CSS_HTML_NAMING_SETTINGS } from '#tests/config/settings/inherit.ts';

test('[naming.css] and [naming.html.folders] accept max_words, max_characters, and cases', async () => {
    await using sandbox = await testdir({ 'gspot.toml': CSS_HTML_NAMING_SETTINGS });
    const { settings, scopes } = await openSession(sandbox.path);
    const { availableSettings } = scopes[0]!;
    const namingRules = { max_words: 3, max_characters: 20, cases: ['kebab'] };
    for (const table of ['naming.css', 'naming.css.files', 'naming.html.folders']) {
        for (const [name, value] of Object.entries(namingRules)) {
            expect(getSettingValue(availableSettings, settings, `${table}.${name}`, '')?.value).toStrictEqual(value);
        }
    }
    expect(findSetting(availableSettings, 'naming.css.functions.max_words')).toBeUndefined();
    expect(findSetting(availableSettings, 'naming.html.types.max_characters')).toBeUndefined();
});

test('a per-language key maps to its base setting', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['bash']) });
    const { scopes } = await openSession(sandbox.path);
    const { availableSettings } = scopes[0]!;

    expect(findSetting(availableSettings, 'limits.bash.function_lines')?.setting.name).toBe('limits.function_lines');
    expect(findSetting(availableSettings, 'limits.python.file_lines')?.language).toBe('python');
    expect(findSetting(availableSettings, 'naming.python.parameters.max_words')?.category).toBe('parameters');
    expect(findSetting(availableSettings, 'limits.nope')).toBeUndefined();
});

test('naming cases equal to the shipped default need no reason, and other cases do', () => {
    const text = buildSandboxSettings(['typescript'], { tables: '[naming.typescript.files]\n cases = ["kebab"]\n' });
    readSettings(text, process.cwd());
    expect(() => readSettings(text.replace('["kebab"]', '["camel"]'), process.cwd())).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'settings',
            message:
                'gspot.toml:3: naming.typescript.files.cases.reason: naming.typescript.files.cases needs a reason. Write it as naming.typescript.files.cases = { value = [...], reason = "..." }, or run gspot set naming.typescript.files.cases ... --reason "<why>".',
        }),
    );
});
