import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { unlinkSync, symlinkSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { preparePolicy } from '#cli/commands/policy-edit.ts';
import { reconcileConfigurations } from '#cli/lifecycle/reconcile.ts';
import { applicableManifests } from '#cli/execution/planning/requirements.ts';

import {
    COMPONENTS,
    LINK_POLICY,
    POLICY_PATHS,
    NODE_REQUIREMENTS,
} from '#tests/config/cli/execution/planning/selection.ts';

test.each(POLICY_PATHS)('a change to %s retains repository-wide inputs and tool exclusions', async (path) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': LINK_POLICY,
        'README.md': '# Root\n',
        'api/guide.md': '# API\n',
        'ignored/guide.md': '# Built pages\n',
    });
    const session = await openSession(sandbox.path);
    expect(session.policyFiles.problems).toStrictEqual([]);
    const planned = planRun(session, { stage: 'commit', skips: [], staged: [path], only: ['docs/lychee'] });
    expect(
        planned.map((entry) => ({
            scope: entry.scope.scope.path,
            files: entry.files.map((file) => file.path).toSorted((left, right) => left.localeCompare(right)),
        })),
    ).toStrictEqual([{ scope: '', files: ['api/guide.md', 'README.md'] }]);
});

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
        problems: [],
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

test('Prettier planning honors linked authored ignores inside the repository and rejects external targets', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    const ignored = 'ignored.md\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['markdown']),
        'settings/format.ignore': ignored,
        'ignored.md': '# Ignored\n',
        'kept.md': '# Kept\n',
    });
    await createFileTree(outside.path, { 'format.ignore': ignored });
    symlinkSync('settings/format.ignore', join(sandbox.path, '.prettierignore'));
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', skips: [], only: ['format/prettier'] });
    expect(plans[0]!.files.map((file) => file.path)).toContain('kept.md');
    expect(plans[0]!.files.map((file) => file.path)).not.toContain('ignored.md');
    unlinkSync(join(sandbox.path, '.prettierignore'));
    symlinkSync(join(outside.path, 'format.ignore'), join(sandbox.path, '.prettierignore'));
    expect(await rejection(openSession(sandbox.path))).toContain('Source link leaves the repository');
    expect(await Bun.file(join(outside.path, 'format.ignore')).text()).toBe(ignored);
});

test.each(NODE_REQUIREMENTS)(
    'applicable tools declare Node only when npm consumers require it: $name',
    async ({ configurations, runner, files, node }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(configurations, { tables: `run_with = "${runner}"\n` }),
            ...files,
        });
        const session = await openSession(sandbox.path);
        const names = applicableManifests(session).flatMap((manifest) => manifest.tools.map((tool) => tool.name));
        expect(names.includes('node')).toBe(node);
        if (configurations.includes('typescript')) {
            expect(names).toContain('eslint');
        } else if (configurations.includes('markdown')) {
            expect(names).toContain('markdownlint-cli2');
        } else {
            expect(names).toContain('ruff');
            expect(names).not.toContain('eslint');
            expect(names).not.toContain('typescript');
        }
    },
);

test('commit planning leaves external document links for later stages', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildPolicy(['docs']), 'guide.md': '# Guide\n' });
    const plans = planRun(await openSession(sandbox.path), { stage: 'commit', skips: [] });
    const checks = plans.map(({ spec }) => spec.name);
    expect(checks).toContain('docs/lychee');
    expect(checks).not.toContain('docs/lychee-external');
});

test('project type checking belongs to push and preserves explicit selection', async () => {
    const check = 'typescript/tsc';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript']),
        'source.ts': 'export const value = 1;\n',
    });
    const session = await openSession(sandbox.path);
    const commit = planRun(session, { stage: 'commit', skips: [], only: [check] });
    expect(commit.map((entry) => entry.spec.name)).not.toContain(check);
    for (const stage of ['push', 'all'] as const) {
        const planned = planRun(session, { stage, skips: [], only: [check] });
        expect(planned.map((entry) => entry.spec.name)).toContain(check);
    }
});

test.each(['bun', 'mise'])('private schema tools include their runtime peer under %s', async (runner) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['files'], { tables: `run_with = "${runner}"\n` }),
        'settings.json': '{"enabled":true}\n',
    });
    const session = await openSession(sandbox.path);
    const names = applicableManifests(session).flatMap((manifest) => manifest.tools.map((tool) => tool.name));
    expect(names).toContain('v8r');
    expect(names.includes('ajv')).toBe(runner === 'bun');
});
