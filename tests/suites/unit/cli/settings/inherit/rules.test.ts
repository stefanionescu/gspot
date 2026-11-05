import { expect, test } from 'bun:test';

import { openSession } from '#cli/engine/session.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test("a scope's rules keep other rules and replace all options of the same rule", async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['css'], {
            rules: true,
            tables: '[tools.stylelint.rules]\nselector-max-id = 0\ncolor-named = ["never", { severity = "error" }]\n[[scope]]\npath = "app"\nconfigurations = []\ntools.stylelint.rules.color-named = ["always-where-possible"]\n',
        }),
        'app/site.css': '',
    });
    const { settings, scopes } = await openSession(sandbox.path);
    const [root, app] = scopes;
    expect(getSettingValue(app!.availableSettings, settings, 'tools.stylelint.rules', 'app')?.value).toStrictEqual({
        'selector-max-id': 0,
        'color-named': ['always-where-possible'],
    });
    expect(getSettingValue(root!.availableSettings, settings, 'tools.stylelint.rules', '')?.value).toStrictEqual({
        'selector-max-id': 0,
        'color-named': ['never', { severity: 'error' }],
    });
});
