import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { planRun } from '#cli/planning/plan.ts';
import { testdir, createFileTree } from 'testdirs';
import { preparePolicy } from '#cli/policy/edit.ts';
import { openSession } from '#cli/commands/session.ts';
import { applicableManifests } from '#cli/planning/requirements.ts';
import { COMPONENTS } from '#tests/config/cli/lifecycle/reconcile.ts';
import { reconcileConfigurations } from '#cli/lifecycle/reconcile.ts';

test.each(COMPONENTS)('reconciliation retains CSS tooling for embedded styles in $path', async ({ path, source }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': 'configurations = ["css"]\n', [path]: source });
    const current = await openSession(sandbox.path);
    const reconciliation = reconcileConfigurations(current);
    const proposal = preparePolicy(sandbox.path, reconciliation.mutate);
    const session = await openSession(sandbox.path, {
        policy: proposal.policy,
        text: proposal.text,
        path: join(sandbox.path, 'gspot.toml'),
        errors: [],
    });
    expect(session.policyFiles.policy.configurations).toContain('css');
    const check = planRun(session, { stage: 'commit', skips: [], only: ['css/stylelint'] });
    expect(
        check.map((entry) => entry.files.map((file) => file.path).toSorted((left, right) => left.localeCompare(right))),
    ).toStrictEqual([[path]]);
    expect(applicableManifests(session).flatMap((manifest) => manifest.tools.map((tool) => tool.name))).toContain(
        'stylelint',
    );
});
