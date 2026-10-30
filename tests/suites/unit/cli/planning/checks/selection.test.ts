import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { compareText } from '#cli/system/text.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { TWO_WORDS } from '#tests/config/ignores.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/planning/session.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { LEVELS } from '#cli/config/manifests/names.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { runCommandCheck } from '#cli/runs/command/check.ts';
import { listAlwaysSelected } from '#tests/setup/cli/manifests.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { SCHEDULE_RELEASE_MARKDOWN } from '#tests/config/documents.ts';
import { runChecks, buildCheckSession } from '#cli/commands/check/run.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { ZERO_COVERAGE_SETTINGS } from '#tests/config/planning/settings.ts';
import { isActive, planChecks, stripCoverageArguments } from '#cli/planning/checks.ts';
import { TSC_REPLACEMENTS, CONFIGURED_CHECK_CASES, SCOPE_WIDE_IGNORE_CASES } from '#tests/config/planning/checks.ts';

test('coverage arguments leave other commands, your own checks, and given arguments unchanged', async () => {
    await using sandbox = await testdir();
    const command = [process.execPath, '--coverage', '', TWO_WORDS];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                command_check: [{ id: 'project/tests', command, stage: 'push', paths: ['sample.test.cjs'] }],
            }),
        }),
        'sample.test.cjs': 'const authored = true;\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'push', only: ['project/tests'] })[0]!;
    using run = spyOn(processes, 'spawnProcess').mockResolvedValue(buildProcessResult());
    await runCommandCheck(buildCheckSession(session), planned);
    await runCommandCheck(buildCheckSession(session), planned, { command });
    expect(run.mock.calls.map(([commandArguments]) => commandArguments)).toStrictEqual([command, command]);
    expect(stripCoverageArguments(planned, { command: ['echo', '', TWO_WORDS] })).toStrictEqual([
        'echo',
        '',
        TWO_WORDS,
    ]);
});

test('a project check with no matching files is skipped even when its scope holds another language', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['python', 'bash']),
        'source.sh': 'echo example\n',
    });

    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ only: ['python/ruff'] });
    const result = await runChecks(session, options);
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks).toMatchObject([
        { check: 'python/ruff', status: 'skipped', cause: 'no-files', findings: [] },
    ]);
});

test.each([...SCOPE_WIDE_IGNORE_CASES])(
    'an ignore of a whole scope keeps the replaced check running there and nowhere else: $paths',
    async ({ paths, ignored }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['typescript'], {
                rules: true,
                scopes: [
                    { path: 'api', configurations: ['nextjs'] },
                    { path: 'web', configurations: ['nextjs'] },
                ],
                tables: stringify({
                    ignore: [
                        {
                            check: 'nextjs/tsc',
                            paths: [...paths],
                            reason: 'The API check is provided by its own native build pipeline.',
                        },
                    ],
                }),
            }),
            'api/app/page.tsx': 'export default function Page() { return null; }',
            'web/app/page.tsx': 'export default function Page() { return null; }',
        });

        const session = await openSession(sandbox.path);
        const planned = planChecks(session, { stage: 'all', only: ['nextjs/tsc', 'typescript/tsc'] });
        const scopes = planned.filter((check) => ['api', 'web'].includes(check.scope.path));
        const results = new Map(scopes.map((check) => [`${check.scope.path}:${check.check.id}`, check.skip?.cause]));
        expect(results).toStrictEqual(
            new Map([
                ['api:nextjs/tsc', ignored ? 'ignore' : undefined],
                ['api:typescript/tsc', ignored ? undefined : 'replaced'],
                ['web:nextjs/tsc', undefined],
                ['web:typescript/tsc', 'replaced'],
            ]),
        );
    },
);

test.each([...LEVELS])(
    '%s selects the always-selected configurations from an empty list and plans their general checks',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([], { level }),
            'source.js': 'export const port = 8080;\n',
            'guide.md': SCHEDULE_RELEASE_MARKDOWN,
            'app/package.json': '{"name":"app","private":true}',
            'app/source.js': 'export const port = 3000;\n',
        });
        commitAll(sandbox.path);
        const session = await openSession(sandbox.path);
        expect(session.settings.configurations).toStrictEqual([]);
        const selected = new Set(
            session.scopes.flatMap((scope) => scope.configurations.map((configuration) => configuration.name)),
        );
        expect([...selected].toSorted(compareText)).toStrictEqual(
            [...listAlwaysSelected(), 'licenses'].toSorted(compareText),
        );
        const checks = planChecks(session, {
            stage: 'all',
            only: ['security/semgrep', 'prose/vale', 'duplication/jscpd', 'licenses/allowed'],
        });
        expect(checks.find((check) => check.check.id === 'prose/vale')?.files.map((file) => file.path)).toStrictEqual([
            'app/source.js',
            'guide.md',
            'source.js',
        ]);
        expect(checks.some((check) => check.check.id === 'duplication/jscpd')).toBe(level === 'all');
        expect(checks.find((check) => check.check.id === 'licenses/allowed')?.skip).toBeUndefined();
    },
);

test.each([...LEVELS])('%s plans history checks once at the root and only for pushed commits', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['commits', 'secrets'], {
            level,
            scopes: [{ path: 'app', configurations: ['commits', 'secrets'] }],
            tables: stringify({
                command_check: [
                    {
                        id: 'sandbox/once',
                        command: ['git', 'log'],
                        paths: ['source.txt', 'app/source.txt'],
                        stage: 'push',
                    },
                ],
            }),
        }),
        'source.txt': 'Root source.\n',
        'app/source.txt': 'Child source.\n',
    });
    const session = await openSession(sandbox.path);
    const names = [...(level === 'all' ? ['commits/commitlint-pushed'] : []), 'secrets/gitleaks-pushed'];
    const planned = planChecks(session, {
        stage: 'push',
        only: [...names, 'sandbox/once'],
        staged: [],
        commits: ['selected'],
    });
    expect(planned.filter((check) => check.check.runs === 'history').map((check) => check.check.id)).toStrictEqual(
        names,
    );
    expect(planned.map((check) => check.scope.path)).toStrictEqual([...names.map(() => ''), '']);
    expect(planned.map((check) => isActive(check))).toStrictEqual([...names.map(() => true), false]);
    expect(
        planChecks(session, { stage: 'push', only: names, staged: [], commits: [] }).map((check) => isActive(check)),
    ).toStrictEqual(names.map(() => false));
    expect(() => planChecks(session, { stage: 'push', only: ['secrets/gitleaks-pushed'], shallow: true })).toThrow(
        new Error('Pushed history is incomplete for secrets/gitleaks-pushed. Run git fetch --unshallow and retry.'),
    );
    expect(planChecks(session, { stage: 'push', only: ['sandbox/once'], shallow: true })).toHaveLength(1);
});

test.each([...CONFIGURED_CHECK_CASES])(
    'planning $check keeps its config-file selection $selected: $name',
    async ({ configurations, options, files, check, selected }) => {
        await using sandbox = await testdir({ ...files, 'gspot.toml': buildSandboxSettings(configurations, options) });
        const session = await openSession(sandbox.path);
        expect(session.configuredChecks.some((configuredCheck) => configuredCheck.check.id === check)).toBe(selected);
    },
);

test.each([...TSC_REPLACEMENTS])(
    '$check replaces typescript/tsc only while it runs',
    async ({ configuration, check, source, text }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['typescript', configuration]),
            'source.ts': 'export const port = 8080;\n',
            [source]: text,
        });
        const session = await openSession(sandbox.path);
        const options = { stage: 'all' as const, only: ['typescript/tsc', check] };
        expect(planChecks(session, options).find(({ check }) => check.id === 'typescript/tsc')?.skip).toStrictEqual({
            cause: 'replaced',
            note: `${check} runs it here`,
        });
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildSandboxSettings(['typescript', configuration], {
                tables: stringify({ ignore: [{ check, reason: 'The separate compiler checks this source.' }] }),
            }),
        );
        const ignored = await openSession(sandbox.path);
        expect(planChecks(ignored, options).find(({ check }) => check.id === 'typescript/tsc')?.skip).toBeUndefined();
        expect(
            planChecks(session, { ...options, only: ['typescript/tsc'] }).find(
                ({ check }) => check.id === 'typescript/tsc',
            )?.skip,
        ).toBeUndefined();
    },
);

test('a nested Next.js check replaces TypeScript only in its own scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            scopes: [{ path: 'app', configurations: ['typescript', 'nextjs'] }],
        }),
        'source.ts': 'export const port = 8080;\n',
        'app/source.ts': 'export const port = 3000;\n',
    });
    const session = await openSession(sandbox.path);
    const configured = planChecks(session, { stage: 'push', only: ['typescript/tsc', 'nextjs/tsc'] })
        .filter((planned) => planned.skip === undefined)
        .filter((configuredCheck) => ['typescript/tsc', 'nextjs/tsc'].includes(configuredCheck.check.id))
        .map((configuredCheck) => [configuredCheck.scope.path, configuredCheck.check.id]);
    expect(configured).toStrictEqual([
        ['', 'typescript/tsc'],
        ['app', 'nextjs/tsc'],
    ]);
});

test('the jest, vitest, and pytest coverage checks drop exactly their coverage arguments when every limit is 0', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'jest', 'vitest', 'python', 'pytest'], {
            tables: ZERO_COVERAGE_SETTINGS,
        }),
        'math.test.js': '',
        'test_math.py': '',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, {
        stage: 'push',
        only: ['jest/coverage', 'vitest/coverage', 'pytest/coverage'],
    });
    expect(planned.map(({ check }) => check.id)).toStrictEqual(['jest/coverage', 'vitest/coverage', 'pytest/coverage']);
    for (const plannedCheck of planned) {
        const command = plannedCheck.check.command!;
        const stripped = stripCoverageArguments(plannedCheck, {})!;
        expect(stripped.length).toBeLessThan(command.length);
        expect(stripped).toStrictEqual(command.filter((argument) => !argument.startsWith('--cov')));
    }
});
