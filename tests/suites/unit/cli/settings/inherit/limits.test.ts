import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/planning/session.ts';
import { findSetting } from '#cli/settings/inherit.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';

test('limits that no check reads are refused', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['sql', 'bash']) });
    const { scopes } = await openSession(sandbox.path);
    const { availableSettings } = scopes[0]!;
    expect(findSetting(availableSettings, 'limits.sql.function_lines')).toBeUndefined();
    expect(findSetting(availableSettings, 'limits.bash.cyclomatic_complexity')).toBeUndefined();
    expect(findSetting(availableSettings, 'limits.sql.function_parameters')).toBeUndefined();
    const errors = validateSettingsText(
        buildSandboxSettings(['sql', 'bash'], {
            rules: true,
            tables: '[limits.sql]\nfunction_lines = 60\n[limits.bash]\ncyclomatic_complexity = 8\n',
        }),
    );
    expect(errors).toHaveLength(2);
    expect(errors[0]).toStartWith(
        'gspot.toml:5: limits.bash.cyclomatic_complexity: There is no setting called limits.bash.cyclomatic_complexity. The limits that bash reads are ',
    );
    expect(errors[1]).toBe(
        'gspot.toml:3: limits.sql.function_lines: There is no setting called limits.sql.function_lines. The limits that sql reads are file_lines.',
    );
});
