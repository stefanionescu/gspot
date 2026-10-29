import { test, expect } from 'bun:test';
import { readSettings } from '#cli/settings/read.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { buildSandboxSettings, buildSelectedAvailableSettings } from '#tests/setup/cli/settings.ts';

test("a scope's rules keep other rules and replace all options of the same rule", () => {
    using sandbox = createTemporaryFolder();
    const availableSettings = buildSelectedAvailableSettings(['css']);
    const settings = readSettings(
        buildSandboxSettings(['css'], {
            rules: true,
            tables: '[tools.stylelint.rules]\nselector-max-id = 0\ncolor-named = ["never", { severity = "error" }]\n[[scope]]\npath = "app"\nconfigurations = []\ntools.stylelint.rules.color-named = ["always-where-possible"]\n',
        }),
        sandbox.path,
    );
    expect(getSettingValue(availableSettings, settings, 'tools.stylelint.rules', 'app')?.value).toStrictEqual({
        'selector-max-id': 0,
        'color-named': ['always-where-possible'],
    });
    expect(getSettingValue(availableSettings, settings, 'tools.stylelint.rules', '')?.value).toStrictEqual({
        'selector-max-id': 0,
        'color-named': ['never', { severity: 'error' }],
    });
});
