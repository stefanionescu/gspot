import { expect, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each([
    { written: 'a general limit', tables: '[limits]\nmax_function_lines = 59\n', expected: 'the shipped value' },
    {
        written: 'a general and a Bash limit',
        tables: '[limits]\nmax_function_lines = 59\n[limits.bash]\nmax_function_lines = { value = 50, reason = "Long installers." }\n',
        expected: 50,
    },
])('with $written in gspot.toml, the Bash function limit is $expected', async ({ tables, expected }) => {
    await using shipped = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'run.sh': '',
    });
    const defaults = await openSession(shipped.path);
    const shippedLimit = getSettingValue(
        defaults.scopes[0]!.availableSettings,
        defaults.settings,
        'limits.bash.max_function_lines',
        '',
    )?.value;
    expect(shippedLimit).toBeNumber();
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true, tables }),
        'run.sh': '',
    });
    const { settings, scopes } = await openSession(sandbox.path);
    const available = scopes[0]!.availableSettings;
    expect({
        general: getSettingValue(available, settings, 'limits.max_function_lines', '')?.value,
        bash: getSettingValue(available, settings, 'limits.bash.max_function_lines', '')?.value,
    }).toStrictEqual({ general: 59, bash: typeof expected === 'number' ? expected : shippedLimit });
});
