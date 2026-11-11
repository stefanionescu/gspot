import { expect, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('limits that no check reads are refused', () => {
    const errors = validateSettingsText(
        buildSandboxSettings(['sql', 'bash'], {
            rules: true,
            tables: '[limits.sql]\nmax_function_lines = 60\n[limits.bash]\nmax_cyclomatic_complexity = 8\n',
        }),
    );
    expect(errors).toStrictEqual([
        'gspot.toml:5: limits.bash.max_cyclomatic_complexity: There is no setting called limits.bash.max_cyclomatic_complexity. The limits that exist are bash.max_file_lines, bash.max_function_lines, bash.max_block_nesting, bash.max_function_branches, bash.max_function_assignments, bash.trivial_function_statements.',
        'gspot.toml:3: limits.sql.max_function_lines: There is no setting called limits.sql.max_function_lines. Did you mean limits.sql.max_file_lines?',
    ]);
});

test.each([
    { written: 'a general limit', tables: '[limits]\nmax_function_lines = 59\n', bash: 40 },
    {
        written: 'a general and a Bash limit',
        tables: '[limits]\nmax_function_lines = 59\n[limits.bash]\nmax_function_lines = { value = 50, reason = "Long installers." }\n',
        bash: 50,
    },
])('with $written in gspot.toml, the Bash function limit is $bash', async ({ tables, bash }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true, tables }),
        'run.sh': '',
    });
    const { settings, scopes } = await openSession(sandbox.path);
    const available = scopes[0]!.availableSettings;
    expect({
        general: getSettingValue(available, settings, 'limits.max_function_lines', '')?.value,
        bash: getSettingValue(available, settings, 'limits.bash.max_function_lines', '')?.value,
    }).toStrictEqual({ general: 59, bash });
});
