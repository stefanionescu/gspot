import { join } from 'node:path';
import { parse } from 'smol-toml';
import { gitOutput } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { unlink, symlink } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { prepare } from '#cli/commands/init/public.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { usePlatform } from '#tests/harness/platforms.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { policySchema } from '#cli/policy/schema/public.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { parseManifest, linkManifestTools } from '#cli/configurations/public.ts';
import { buildPolicy, alwaysSelectedConfigurations } from '#tests/harness/policy.ts';
import { planRun, isActive, checkCompanions, requiredToolNames, applicableManifests } from '#cli/planning/public.ts';

import {
    HOOK_STAGES,
    LINK_POLICY,
    POLICY_PATHS,
    HISTORY_TABLES,
    AUTOMATIC_CHECKS,
    HISTORY_MANIFEST,
    HOOK_STAGE_FILES,
    NEXT_BUILD_FILES,
    HOOK_STAGE_CHECKS,
    MANUAL_SELECTIONS,
    NEXT_BUILD_ROUTES,
    NEXT_BUILD_TABLES,
    COVERAGE_PLUGIN_CASES,
} from '#tests/config/cli/planning/selection.ts';

test.each(MANUAL_SELECTIONS)(
    'manual configurations %j retain automatic checks and level-dependent tools',
    async ({ configurations }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            'source.js': 'export const port = 8080;\n',
            'site.webmanifest': '{}',
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
            expect(session.scopes[0]!.selected.some(({ configuration }) => configuration.name === 'site')).toBe(false);
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
            expect(names).not.toContain('codeql');
        }
        const allowed = await runGspot(sandbox.path, ['set', 'licenses.allowed', 'MIT']);
        expect(allowed.code, allowed.stdout + allowed.stderr).toBe(0);
        const configured = await openSession(sandbox.path);
        expect(
            planRun(configured, { stage: 'all', skips: [], only: ['licenses/allowed'] }).map((check) => check.skip),
        ).toStrictEqual([undefined]);
        expect(
            applicableManifests(configured).flatMap((manifest) => manifest.tools.map((tool) => tool.name)),
        ).toContain('license-checker-rseidelsohn');
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

describe.each(['recommended', 'all'] as const)('%s hooks plan declared stages', (level) => {
    const resources = new AsyncDisposableStack();
    let session: Session;
    let every: PlannedCheck[];
    beforeAll(async () => {
        const sandbox = resources.use(
            await testdir({
                'gspot.toml': buildPolicy(['files', 'swift', 'nginx', 'typescript', 'docs'], { level }),
                ...HOOK_STAGE_FILES,
            }),
        );
        session = await openSession(sandbox.path);
        every = planRun(session, { stage: 'any', skips: [], includeUnsupported: true });
    });
    afterAll(() => resources.disposeAsync());

    test.each(['push', 'all'] as const)('%s explicitly selects TypeScript', (stage) => {
        const explicit = planRun(session, { stage, skips: [], only: ['typescript/tsc'] });
        expect(explicit.map((entry) => entry.check.name)).toContain('typescript/tsc');
    });
    test.each(HOOK_STAGE_CHECKS)('the complete plan includes %s', (check) => {
        expect(every.map((entry) => entry.check.name)).toContain(check);
    });
    test.each(HOOK_STAGES)('%s selects the declared %s stage', (hook, stage) => {
        const planned = planRun(session, { stage, skips: [], includeUnsupported: true });
        const ids = planned.map((entry) => entry.check.name);
        const expected = [];
        for (const { check, manifest } of every)
            if (manifest!.checks.find(({ name }) => name === check.name)!.stage === stage) expected.push(check.name);
        expect(ids, hook).toStrictEqual(expected);
        if (stage === 'commit') {
            expect(ids).toContain('docs/lychee');
            expect(ids).not.toContain('docs/lychee-external');
            expect(ids).not.toContain('typescript/tsc');
        }
    });
    test('Windows retains the explicit platform skip', () => {
        using _platform = usePlatform('win32');
        expect(planRun(session, { stage: 'all', skips: [], only: ['security/semgrep'] })).toMatchObject([
            { check: { name: 'security/semgrep' }, skip: { cause: 'platform' } },
        ]);
    });
});

describe.each([...COVERAGE_PLUGIN_CASES])(
    '%s %s coverage requires its host plugin for the %s floor',
    (configuration, level, dimension) => {
        const resources = new AsyncDisposableStack();
        const provider = configuration === 'pytest' ? 'pytest-cov' : '@vitest/coverage-v8';
        let session: Session;
        let checks: PlannedCheck[];
        beforeAll(async () => {
            const sandbox = resources.use(await testdir());
            const source = configuration === 'pytest' ? 'test_math.py' : 'math.test.js';
            const setups = configuration === 'pytest' ? ['python', 'pytest'] : ['javascript', 'vitest'];
            await createFileTree(sandbox.path, { [source]: '', ['app/' + source]: '' });
            const floors = { lines: 0, branches: 0, functions: 0, statements: 0 };
            if (dimension !== 'zero') floors[dimension] = 80;
            const tables =
                '[coverage]\n' +
                Object.entries(floors)
                    .map(([name, value]) => `${name} = ${String(value)}`)
                    .join('\n') +
                '\n[reasons]\n"coverage.lines" = "This sandbox tests optional coverage."\n"coverage.branches" = "This sandbox tests optional coverage."\n"coverage.functions" = "This sandbox tests optional coverage."\n"coverage.statements" = "This sandbox tests optional coverage."\n' +
                '[scope."app"]\nconfigurations = [' +
                setups.map((name) => `"${name}"`).join(', ') +
                ']\n';
            await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(setups, { level, tables }));
            session = await openSession(sandbox.path);
            checks = planRun(session, { stage: 'push', skips: [], only: [configuration + '/coverage'] });
        });
        afterAll(() => resources.disposeAsync());

        test('the plan retains root and child with the optional provider', () => {
            expect(checks.map((check) => check.scope.scope.path)).toStrictEqual(['', 'app']);
            expect(
                applicableManifests(session)
                    .flatMap((manifest) => manifest.tools)
                    .some((tool) => tool.name === provider),
            ).toBe(dimension !== 'zero');
        });
        test.each(['', 'app'])('scope %s retains provider requirements and companions', (scope) => {
            const check = checks.find((planned) => planned.scope.scope.path === scope)!;
            expect(requiredToolNames(check, session).includes(provider)).toBe(dimension !== 'zero');
            expect(checkCompanions(check.scope, check.check, check.check.command)).toContain(provider);
        });
    },
);

test.each(['recommended', 'all'] as const)('%s plans declared history once without source triggers', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildPolicy(['commits', 'secrets'], { level, tables: HISTORY_TABLES }),
        'source.txt': 'Root source.\n',
        'app/source.txt': 'Child source.\n',
    });
    gitOutput(sandbox.path, ['init']);
    const opened = await openSession(sandbox.path);
    const manifest = linkManifestTools([parseManifest(HISTORY_MANIFEST, 'configurations/general/sandbox')]).get(
        'sandbox',
    )!;
    const session = {
        ...opened,
        scopes: opened.scopes.map((scope) => ({ ...scope, selected: [...scope.selected, manifest] })),
    };
    const names = [
        ...(level === 'all' ? ['commits/commitlint-pushed'] : []),
        'secrets/gitleaks-pushed',
        'secrets/trufflehog',
        'sandbox/pushed',
    ];
    const planned = planRun(session, {
        stage: 'push',
        skips: [],
        only: [...names, 'sandbox/once'],
        staged: [],
        commits: ['selected'],
    });
    expect(planned.filter((check) => check.check.runs === 'history').map((check) => check.check.name)).toStrictEqual(
        names,
    );
    expect(planned.map((check) => check.scope.scope.path)).toStrictEqual([...names.map(() => ''), '']);
    expect(planned.map((check) => isActive(check))).toStrictEqual([...names.map(() => true), false]);
    expect(
        planRun(session, { stage: 'push', skips: [], only: names, staged: [], commits: [] }).map((check) =>
            isActive(check),
        ),
    ).toStrictEqual(names.map(() => false));
    expect(() =>
        planRun(session, { stage: 'push', skips: [], only: ['sandbox/pushed'], historyComplete: false }),
    ).toThrow('Pushed history is incomplete for sandbox/pushed');
    expect(planRun(session, { stage: 'push', skips: [], only: ['sandbox/once'], historyComplete: false })).toHaveLength(
        1,
    );
});
