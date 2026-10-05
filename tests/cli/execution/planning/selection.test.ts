import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { unlinkSync, symlinkSync } from 'node:fs';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { prepare } from '#cli/commands/init/prepare.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { planRun } from '#cli/execution/planning/plan.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { preparePolicy } from '#cli/commands/policy-edit.ts';
import type { RawPolicy } from '#cli/types/policy/settings.ts';
import { reconcileConfigurations } from '#cli/lifecycle/reconcile.ts';
import { applicableManifests } from '#cli/execution/planning/requirements.ts';

import {
    COMPONENTS,
    LINK_POLICY,
    POLICY_PATHS,
    NODE_REQUIREMENTS,
} from '#tests/config/cli/execution/planning/selection.ts';

test('a check version prerequisite cannot lower its tool-wide requirement', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python']),
        'source.py': 'print("example")\n',
    });
    const session = await openSession(sandbox.path);
    const python = session.manifests.get('python')!;
    const ruff = python.checks.find((check) => check.name === 'python/ruff')!;
    ruff.min_versions = { ruff: '0.8.0' };
    const lower = planRun(session, { stage: 'all', skips: [], only: ['python/ruff'] });
    expect(lower[0]?.tool?.min_version).toBe('0.9.0');
    ruff.min_versions = { ruff: '0.10.0' };
    const higher = planRun(session, { stage: 'all', skips: [], only: ['python/ruff'] });
    expect(higher[0]?.tool?.min_version).toBe('0.10.0');
});

test('automatic configurations use only the level to select checks and their required tools', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"example","private":true,"type":"module"}\n',
        'source.js': 'export const port = 8080;\n',
        'app/package.json': '{"name":"app","private":true,"type":"module"}\n',
        'app/source.js': 'export const port = 3000;\n',
    });
    const interactive = await prepare(sandbox.path, buildInitOptions(sandbox.path, { yes: false, isDryRun: true }));
    const accepted = await prepare(sandbox.path, buildInitOptions(sandbox.path, { isDryRun: true }));
    expect(interactive.policyText).toBe(accepted.policyText);
    expect(interactive.plan).toStrictEqual(accepted.plan);
    const policy = parse(accepted.policyText) as RawPolicy;
    for (const configuration of ['security', 'duplication', 'licenses'])
        expect(policy.configurations).toContain(configuration);
    await Bun.write(join(sandbox.path, 'gspot.toml'), accepted.policyText);
    for (const level of ['recommended', 'all', 'recommended'] as const) {
        const changed = await runGspot(sandbox.path, ['set', 'level', level]);
        expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        const session = await openSession(sandbox.path);
        const checks = planRun(session, {
            stage: 'all',
            skips: [],
            includeUnsupported: true,
            only: [
                'security/semgrep',
                'security/semgrep-registry',
                'security/codeql',
                'duplication/jscpd',
                'licenses/packages',
            ],
        });
        const names = applicableManifests(session).flatMap((manifest) => manifest.tools.map((tool) => tool.name));
        expect(
            checks.filter((check) => check.spec.name === 'security/semgrep').map((check) => check.skip),
        ).toStrictEqual([undefined, undefined]);
        expect(
            checks.filter((check) => check.spec.name === 'duplication/jscpd').map((check) => check.skip?.cause),
        ).toStrictEqual(level === 'all' ? [undefined, undefined] : []);
        expect(
            checks.filter((check) => check.spec.name === 'licenses/packages').map((check) => check.skip?.cause),
        ).toStrictEqual(['setting', 'setting']);
        expect(names).toContain('semgrep');
        expect(names.includes('jscpd')).toBe(level === 'all');
        expect(names).not.toContain('license-checker-rseidelsohn');
        expect(names).not.toContain('codeql');
    }
    const allowed = await runGspot(sandbox.path, ['set', 'licenses.allowed', 'MIT']);
    expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
    const configured = await openSession(sandbox.path);
    expect(
        planRun(configured, { stage: 'all', skips: [], only: ['licenses/packages'] }).map((check) => check.skip),
    ).toStrictEqual([undefined, undefined]);
    expect(applicableManifests(configured).flatMap((manifest) => manifest.tools.map((tool) => tool.name))).toContain(
        'license-checker-rseidelsohn',
    );
});

test.each(['recommended', 'all'] as const)(
    '%s reports manual security project prerequisites explicitly',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['security'], { level }),
            'source.js': 'export const port = 8080;\n',
        });
        const checks = planRun(await openSession(sandbox.path), {
            stage: 'all',
            skips: [],
            includeUnsupported: true,
            only: ['security/semgrep-registry', 'security/codeql'],
        });
        expect(
            checks.map((check) => ({ check: check.spec.name, cause: check.skip?.cause, note: check.skip?.note })),
        ).toStrictEqual([
            {
                check: 'security/semgrep-registry',
                cause: undefined,
                note: undefined,
            },
            {
                check: 'security/codeql',
                cause: 'setting',
                note: 'requires project setting tools.codeql.languages',
            },
        ]);
    },
);

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
