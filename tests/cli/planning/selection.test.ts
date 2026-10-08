import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { unlink, symlink } from 'node:fs/promises';
import { preparePolicy } from '#cli/policy/edit.ts';
import { toolPin } from '#cli/configurations/pins.ts';
import { openSession } from '#cli/commands/session.ts';
import { prepare } from '#cli/commands/init/prepare.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { policySchema } from '#cli/policy/schema/policy.ts';
import { planRun, configuredChecks } from '#cli/planning/plan.ts';
import { applicableManifests } from '#cli/planning/requirements.ts';
import { reconcileConfigurations } from '#cli/lifecycle/reconcile.ts';
import { buildPolicy, alwaysSelectedConfigurations } from '#tests/harness/policy.ts';

import {
    COMPONENTS,
    LINK_POLICY,
    POLICY_PATHS,
    AUTOMATIC_CHECKS,
    NEXT_BUILD_FILES,
    MANUAL_SELECTIONS,
    NEXT_BUILD_ROUTES,
    NEXT_BUILD_TABLES,
    NODE_REQUIREMENTS,
} from '#tests/config/cli/planning/selection.ts';

test('a nested Next.js check replaces TypeScript only in its own scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['typescript'], {
            tables: '[scope."app"]\nconfigurations = ["typescript", "nextjs"]',
        }),
        'source.ts': 'export const port = 8080;\n',
        'app/source.ts': 'export const port = 3000;\n',
    });
    const configured = configuredChecks(await openSession(sandbox.path), true)
        .filter((entry) => ['typescript/tsc', 'nextjs/tsc'].includes(entry.check.name))
        .map((entry) => [entry.scope.scope.path, entry.check.name]);
    expect(configured).toStrictEqual([
        ['', 'typescript/tsc'],
        ['app', 'nextjs/tsc'],
    ]);
});

test('a check version prerequisite cannot lower its tool-wide requirement', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['python']),
        'source.py': 'print("example")\n',
    });
    const session = await openSession(sandbox.path);
    const ruff = session.manifests.get('python')!.checks.find((check) => check.name === 'python/ruff')!;
    const tool = toolPin(session.manifests.values(), 'ruff');
    for (const required of ['0.0.0', tool.version!]) {
        ruff.min_versions = { ruff: required };
        const [planned] = planRun(session, { stage: 'all', skips: [], only: ['python/ruff'] });
        expect(planned?.tool?.min_version).toBe(required === '0.0.0' ? tool.min_version : required);
    }
});

test.each(MANUAL_SELECTIONS)(
    'manual configurations %j retain automatic checks and level-dependent tools',
    async ({ configurations }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            'source.js': 'export const port = 8080;\n',
            'app/package.json': '{"name":"app","private":true,"type":"module"}\n',
            'app/source.js': 'export const port = 3000;\n',
        });
        const options = {
            isDryRun: true,
            ...(configurations === undefined ? {} : { configurations: [...configurations] }),
            scopes: new Map([['app', ['javascript']]]),
        };
        const interactive = await prepare(sandbox.path, buildInitOptions(sandbox.path, { ...options, yes: false }));
        const accepted = await prepare(sandbox.path, buildInitOptions(sandbox.path, options));
        expect(interactive.policyText).toBe(accepted.policyText);
        expect(interactive.plan).toStrictEqual(accepted.plan);
        const policy = policySchema.parse(parse(accepted.policyText));
        for (const configuration of [...alwaysSelectedConfigurations(), 'licenses'])
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
                only: AUTOMATIC_CHECKS,
            });
            const names = applicableManifests(session).flatMap((manifest) => manifest.tools.map((tool) => tool.name));
            expect(
                checks.filter((check) => check.check.name === 'security/semgrep').map((check) => check.skip?.cause),
            ).toStrictEqual(configurations === undefined ? [undefined, undefined] : ['condition', undefined]);
            expect(
                checks.filter((check) => check.check.name === 'duplication/jscpd').map((check) => check.skip?.cause),
            ).toStrictEqual(level === 'all' ? [undefined, undefined] : []);
            expect(
                checks.filter((check) => check.check.name === 'licenses/packages').map((check) => check.skip?.cause),
            ).toStrictEqual([undefined]);
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
        ).toStrictEqual([undefined]);
        expect(
            applicableManifests(configured).flatMap((manifest) => manifest.tools.map((tool) => tool.name)),
        ).toContain('license-checker-rseidelsohn');
    },
);

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
            checks.map((check) => ({ check: check.check.name, cause: check.skip?.cause, note: check.skip?.note })),
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

test.each(POLICY_PATHS)('a change to %s retains project inputs and check path ignores', async (path) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': LINK_POLICY,
        'README.md': '# Root\n',
        'api/guide.md': '# API\n',
        'ignored/guide.md': '# Built pages\n',
    });
    const session = await openSession(sandbox.path);
    expect(session.policyFiles.errors).toStrictEqual([]);
    const planned = planRun(session, { stage: 'commit', skips: [], staged: [path], only: ['docs/lychee'] });
    expect(
        planned.map((entry) => ({
            scope: entry.scope.scope.path,
            files: entry.files.map((file) => file.path).toSorted((left, right) => left.localeCompare(right)),
        })),
    ).toStrictEqual([
        { scope: '', files: ['README.md'] },
        { scope: 'api', files: ['api/guide.md'] },
    ]);
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

test('Prettier planning honors linked authored ignores inside the repository and rejects external targets', async () => {
    await using sandbox = await testdir();
    await using outside = await testdir();
    const ignored = 'ignored.md\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['markdown']),
        'settings/format.ignore': ignored,
        '.gspot/config/.keep': '',
        'ignored.md': '# Ignored\n',
        'kept.md': '# Kept\n',
    });
    await createFileTree(outside.path, { 'format.ignore': ignored });
    await symlink('../../settings/format.ignore', join(sandbox.path, '.gspot/config/prettierignore'));
    const session = await openSession(sandbox.path);
    const plans = planRun(session, { stage: 'commit', skips: [], only: ['format/prettier'] });
    expect(plans[0]!.files.map((file) => file.path)).toContain('kept.md');
    expect(plans[0]!.files.map((file) => file.path)).not.toContain('ignored.md');
    await unlink(join(sandbox.path, '.gspot/config/prettierignore'));
    await symlink(join(outside.path, 'format.ignore'), join(sandbox.path, '.gspot/config/prettierignore'));
    expect(await rejection(openSession(sandbox.path))).toContain('Source link leaves the repository');
    expect(await Bun.file(join(outside.path, 'format.ignore')).text()).toBe(ignored);
});

test.each(NODE_REQUIREMENTS)(
    'applicable tools declare Node only when npm consumers require it: $name',
    async ({ configurations, runner, files, node }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(configurations, { tables: `runner = "${runner}"\n` }),
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
    const checks = plans.map(({ check }) => check.name);
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
    expect(commit.map((entry) => entry.check.name)).not.toContain(check);
    for (const stage of ['push', 'all'] as const) {
        const planned = planRun(session, { stage, skips: [], only: [check] });
        expect(planned.map((entry) => entry.check.name)).toContain(check);
    }
});

test.each(['bun', 'mise'])('private schema tools include their runtime peer under %s', async (runner) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['files'], { tables: `runner = "${runner}"\n` }),
        'settings.json': '{"enabled":true}\n',
    });
    const session = await openSession(sandbox.path);
    const names = applicableManifests(session).flatMap((manifest) => manifest.tools.map((tool) => tool.name));
    expect(names).toContain('v8r');
    expect(names.includes('ajv')).toBe(runner === 'bun');
});

test.each((['recommended', 'all'] as const).flatMap((level) => NEXT_BUILD_ROUTES.map((route) => ({ level, route }))))(
    '$level selects Next.js builds for $route only in app scopes and retains all project inputs',
    async ({ level, route }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['nextjs'], { level, tables: NEXT_BUILD_TABLES }),
            ...NEXT_BUILD_FILES,
            [`web/${route}`]: 'export default function Page() { return null; }\n',
        });
        const planned = planRun(await openSession(sandbox.path), {
            stage: 'push',
            skips: [],
            only: ['nextjs/build'],
        });
        if (level === 'recommended') {
            expect(planned).toStrictEqual([]);
            return;
        }
        expect(planned.find((entry) => entry.scope.scope.path === '')).toMatchObject({
            files: [],
            triggerPaths: [],
        });
        const app = planned.find((entry) => entry.scope.scope.path === 'web');
        expect(app?.skip).toBeUndefined();
        expect(app?.files.map((file) => file.path).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
            ['web/package.json', 'web/src/data.ts', 'web/tsconfig.json', `web/${route}`].toSorted((left, right) =>
                left.localeCompare(right),
            ),
        );
    },
);
