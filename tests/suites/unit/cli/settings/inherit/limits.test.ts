import { test, expect } from 'bun:test';
import { findSetting } from '#cli/settings/inherit.ts';

import {
    buildSandboxSettings,
    validateSettingsText,
    buildSelectedAvailableSettings,
} from '#tests/setup/cli/settings.ts';

test('limits that no check reads are refused', () => {
    const availableSettings = buildSelectedAvailableSettings(['structure', 'sql', 'bash']);
    expect(findSetting(availableSettings, 'limits.sql.function_lines')).toBeUndefined();
    expect(findSetting(availableSettings, 'limits.bash.cyclomatic_complexity')).toBeUndefined();
    expect(findSetting(availableSettings, 'limits.sql.function_parameters')).toBeUndefined();
    const errors = validateSettingsText(
        buildSandboxSettings(['sql', 'bash'], {
            rules: true,
            tables: '[limits.sql]\nfunction_lines = 60\n[limits.bash]\ncyclomatic_complexity = 8\n',
        }),
    );
    expect(errors).toStrictEqual([
        'gspot.toml:6: limits.bash.cyclomatic_complexity: limits.bash.cyclomatic_complexity is not a limit any check reads. The limits that bash reads are file_lines, function_lines, block_nesting, function_branches, function_assignments, trivial_function_statements.',
        'gspot.toml:4: limits.sql.function_lines: limits.sql.function_lines is not a limit any check reads. The limits that sql reads are file_lines.',
    ]);
});
