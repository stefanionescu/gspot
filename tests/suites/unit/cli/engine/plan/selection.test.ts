import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { isActive, planChecks, stripCoverageArguments } from '#cli/engine/plan.ts';
import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { listAlwaysSelected } from '#cli/manifests/select.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { compareText } from '#cli/system/text.ts';
import type { RunSelection } from '#cli/types/engine/plan.ts';
import { SCOPE_WIDE_IGNORE_CASES, TSC_REPLACEMENT } from '#tests/config/engine/run.ts';
import { SCHEDULE_RELEASE_MARKDOWN } from '#tests/config/setup/configurations.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

const TWO_WORDS = 'two words';

test('coverage stripping leaves your own checks and given arguments unchanged', async () => {
    const command = [process.execPath, '--coverage', '', TWO_WORDS];
    await using sandbox = await createGitSandbox({
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
    expect(stripCoverageArguments(planned, {})).toStrictEqual(command);
    expect(stripCoverageArguments(planned, { command: ['echo', '', TWO_WORDS] })).toStrictEqual([
        'echo',
        '',
        TWO_WORDS,
    ]);
});

test('a project check with no matching files is skipped even when its scope holds another language', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['python', 'bash']),
        'source.sh': 'echo example\n',
    });

    const session = await openSession(sandbox.path);
    const options = buildRunOptions({ only: ['python/ruff'], verbose: false });
    const result = await runChecks(session, options);
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks).toMatchObject([]);
});

test.each([...SCOPE_WIDE_IGNORE_CASES])(
    'an ignore of a whole scope keeps the replaced check running there and nowhere else: $paths',
    async ({ paths, ignored }) => {
        await using sandbox = await createGitSandbox({
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

test('all selects the always-selected configurations from an empty list', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { level: 'all' }),
        'source.js': 'export const port = 8080;\n',
        'guide.md': SCHEDULE_RELEASE_MARKDOWN,
        'app/package.json': '{"name":"app","private":true}',
        'app/source.js': 'export const port = 3000;\n',
    });
    commitAll(sandbox.path);
    const session = await openSession(sandbox.path);
    const selected = new Set(
        session.scopes.flatMap((scope) => scope.configurations.map((configuration) => configuration.name)),
    );
    expect([...selected].toSorted(compareText)).toStrictEqual(listAlwaysSelected().toSorted(compareText));
});

test('all plans history checks once at the root and only for pushed commits', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['commits', 'secrets'], {
            level: 'all',
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
    const names = ['commits/commitlint-pushed', 'secrets/gitleaks-pushed'];
    const pushed: RunSelection = { content: 'commit', paths: [], commits: ['selected'] };
    const planned = planChecks(session, { stage: 'push', only: [...names, 'sandbox/once'], selection: pushed });
    expect(planned.map((check) => check.scope.path)).toStrictEqual([...names.map(() => ''), '']);
    expect(planned.map((check) => isActive(check, pushed))).toStrictEqual([...names.map(() => true), false]);
    const empty: RunSelection = { content: 'commit', paths: [], commits: [] };
    expect(
        planChecks(session, { stage: 'push', only: names, selection: empty }).map((check) => isActive(check, empty)),
    ).toStrictEqual(names.map(() => false));
    const shallow: RunSelection = { content: 'commit', shallow: true };
    expect(() => planChecks(session, { stage: 'push', only: ['secrets/gitleaks-pushed'], selection: shallow })).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'git',
            message: expect.stringContaining('secrets/gitleaks-pushed') as string,
        }),
    );
    expect(planChecks(session, { stage: 'push', only: ['sandbox/once'], selection: shallow })).toHaveLength(1);
});

test('vue/vue-tsc replaces typescript/tsc only while it runs', async () => {
    const { configuration, check, source, text } = TSC_REPLACEMENT;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', configuration]),
        'source.ts': 'export const port = 8080;\n',
        [source]: text,
    });
    const session = await openSession(sandbox.path);
    const options = { stage: 'all' as const, only: ['typescript/tsc', check] };
    expect(planChecks(session, options).find(({ check }) => check.id === 'typescript/tsc')?.skip).toStrictEqual({
        cause: 'replaced',
        note: expect.stringContaining(check) as string,
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
        planChecks(session, { ...options, only: ['typescript/tsc'] }).find(({ check }) => check.id === 'typescript/tsc')
            ?.skip,
    ).toBeUndefined();
});
