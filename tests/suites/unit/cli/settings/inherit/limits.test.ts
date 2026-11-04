import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';

test('limits that no check reads are refused', () => {
    const errors = validateSettingsText(
        buildSandboxSettings(['sql', 'bash'], {
            rules: true,
            tables: '[limits.sql]\nmax_function_lines = 60\n[limits.bash]\nmax_cyclomatic_complexity = 8\n',
        }),
    );
    expect(errors).toStrictEqual([
        'gspot.toml:5: limits.bash.max_cyclomatic_complexity',
        'gspot.toml:3: limits.sql.max_function_lines',
    ]);
});

test.each([
    { tables: '[limits]\nmax_function_lines = 59\n', general: 59, bash: 40 },
    {
        tables: '[limits]\nmax_function_lines = 59\n[limits.bash]\nmax_function_lines = { value = 50, reason = "Long installers." }\n',
        general: 59,
        bash: 50,
    },
])(
    'a shipped Bash limit outranks a general limit that you write, and a Bash limit you write outranks both',
    async ({ tables, general, bash }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['bash'], { rules: true, tables }),
            'run.sh': '',
        });
        const { settings, scopes } = await openSession(sandbox.path);
        const available = scopes[0]!.availableSettings;
        expect({
            general: getSettingValue(available, settings, 'limits.max_function_lines', '')?.value,
            bash: getSettingValue(available, settings, 'limits.bash.max_function_lines', '')?.value,
        }).toStrictEqual({ general, bash });
    },
);
