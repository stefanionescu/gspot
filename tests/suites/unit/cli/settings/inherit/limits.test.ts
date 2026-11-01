import { test, expect } from 'bun:test';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';

test('limits that no check reads are refused', () => {
    const errors = validateSettingsText(
        buildSandboxSettings(['sql', 'bash'], {
            rules: true,
            tables: '[limits.sql]\nfunction_lines = 60\n[limits.bash]\ncyclomatic_complexity = 8\n',
        }),
    );
    expect(errors).toHaveLength(2);
    expect(errors[0]).toStartWith(
        'gspot.toml:5: limits.bash.cyclomatic_complexity: There is no setting called limits.bash.cyclomatic_complexity. ',
    );
    expect(errors[1]).toStartWith(
        'gspot.toml:3: limits.sql.function_lines: There is no setting called limits.sql.function_lines.',
    );
});
