import { expect, test } from 'bun:test';

import { formatInitPlan } from '#cli/generation/setup/report.ts';
import { planSandboxInit } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

const WORKSPACE_PYTHON_FILES = {
    'package.json': '{"private":true,"workspaces":["service"]}',
    'source.ts': 'export {};\n',
    'service/package.json': '{"private":true}',
    'service/main.py': 'value = 1\n',
} as const;

test('the init plan prints each scope, folds the always-selected configurations, and shows gspot.toml', async () => {
    await using sandbox = await createGitSandbox({ ...WORKSPACE_PYTHON_FILES, 'AGENTS.md': '# Agents\n' });
    const { plan, settingsText } = await planSandboxInit(sandbox.path);
    const printed = formatInitPlan(plan, settingsText);
    expect(printed).toMatch(/^ {2}python +detected +service +\d+ checks \(\d+ off at basic\)$/mu);
    expect(printed).toMatch(/^ {2}\d+ always-selected configurations: \d+ checks \(\d+ off at basic\)$/mu);
    expect(printed).not.toMatch(/^ {2}format /mu);
    expect(printed).toContain('gspot.toml\n  # Change these settings');
    expect(printed).toMatch(/^ {2}\.gspot\/package\.json +\d+ pinned npm tools; lockfile written by gspot install$/mu);
    expect(printed).toMatch(/^change\n(?: {2}.+\n)*? {2}AGENTS\.md +adds the gspot block$/mu);
});
