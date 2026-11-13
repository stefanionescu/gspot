import { expect, test } from 'bun:test';

import { SETTING_RULE_OPTIONS } from '#tests/config/settings/validation.ts';
import { validateSettingsText } from '#tests/setup/cli/settings.ts';

test.each([...SETTING_RULE_OPTIONS])('options for $rule are refused with $setting', ({ tables, setting, start }) => {
    const errors = validateSettingsText(`configurations = ["javascript", "markdown"]\n${tables}`);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toStartWith(start);
    expect(errors[0]).toContain(setting);
});

test('a rule named constructor is not mistaken for a setting-owned rule', () => {
    expect(
        validateSettingsText('configurations = ["javascript"]\n[tools.eslint.rules]\n"constructor" = [{}]\n'),
    ).toStrictEqual([]);
});
