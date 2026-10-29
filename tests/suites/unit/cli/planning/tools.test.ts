import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { type Session } from '#cli/types/session.ts';
import { openSession } from '#cli/planning/session.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { listOtherTools, listCheckTools } from '#cli/planning/tools.ts';
import { ZERO_COVERAGE_SETTINGS } from '#tests/config/planning/settings.ts';

import {
    NODE_REQUIREMENTS,
    COVERAGE_PROVIDERS,
    INDEPENDENT_LIBRARIES,
    ARCHITECTURE_REQUIREMENTS,
} from '#tests/config/planning/tools.ts';

test('basic tRPC server files select the boundaries plugin without import rules', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'trpc'], {
            tables: '[trpc]\nserver_files = ["server/**"]\n',
        }),
        'server/router.ts': 'export const router = {};\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'commit', only: ['javascript/eslint'] })[0]!;
    expect(listCheckTools(planned)).toContain('eslint-plugin-boundaries');
    expect(session.toolConfigurations.flatMap(({ tools }) => tools.map(({ name }) => name))).toContain(
        'eslint-plugin-boundaries',
    );
});

test.each([...NODE_REQUIREMENTS])(
    'the tools include Node only when an npm tool needs it: $name',
    async ({ configurations, tables, files, needs, skips }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(configurations, { tables }),
            ...files,
        });

        const session = await openSession(sandbox.path);
        const names = new Set(
            session.toolConfigurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)),
        );
        expect(needs.filter((name) => !names.has(name))).toStrictEqual([]);
        expect(skips.filter((name) => names.has(name))).toStrictEqual([]);
    },
);

test.each(ARCHITECTURE_REQUIREMENTS.flatMap((requirement) => LEVELS.map((level) => ({ ...requirement, level }))))(
    'eslint-plugin-boundaries is a tool of $name only at the levels that use it: $level',
    async ({ tables, boundary, level }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript'], {
                level,
                scopes: [{ path: 'app', configurations: ['javascript'] }],
                tables,
            }),
            'src/source.js': 'export const value = 1;\n',
            'app/src/source.js': 'export const value = 2;\n',
        });
        const session = await openSession(sandbox.path);
        expect(session.scopes.map(({ path }) => path)).toStrictEqual(['', 'app']);
        const names = session.toolConfigurations.flatMap((configuration) =>
            configuration.tools.map((tool) => tool.name),
        );
        expect(names.includes('eslint-plugin-boundaries')).toBe(boundary[level]);
        const checks = planChecks(session, { stage: 'all', only: ['javascript/eslint'] });
        for (const check of checks) {
            expect(listOtherTools(check.scope, check.check).includes('eslint-plugin-boundaries')).toBe(boundary[level]);
            expect(listCheckTools(check).includes('eslint-plugin-boundaries')).toBe(boundary[level]);
        }
    },
);

describe.each(COVERAGE_PROVIDERS.flatMap((row) => [0, 80].map((lines) => ({ ...row, lines }))))(
    '$configuration coverage at the $lines limit',
    ({ configuration, provider, file, configurations, lines }) => {
        const resources = new AsyncDisposableStack();
        let session: Session;
        let checks: PlannedCheck[];
        beforeAll(async () => {
            const sandbox = resources.use(await testdir());
            await createFileTree(sandbox.path, { [file]: '', ['app/' + file]: '' });
            await writeFile(
                join(sandbox.path, 'gspot.toml'),
                buildSandboxSettings(configurations, {
                    scopes: [{ path: 'app', configurations }],
                    tables: `[coverage]\nlines = ${String(lines)}\n`,
                }),
            );
            session = await openSession(sandbox.path);
            checks = planChecks(session, { stage: 'push', only: [configuration + '/coverage'] });
        });
        afterAll(() => resources.disposeAsync());
        test.each(['', 'app'])(
            'scope %p needs the coverage provider only above a zero limit and always lists it among the other tools',
            (scope) => {
                const check = checks.find((planned) => planned.scope.path === scope)!;
                expect(listCheckTools(check)).toStrictEqual([configuration, ...(lines === 0 ? [] : [provider])]);
                expect(listOtherTools(check.scope, check.check, check.check.command)).toStrictEqual([provider]);
            },
        );
    },
);

test('omitting coverage keeps unrelated system libraries required by another configuration', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'vitest'], {
            tables: ZERO_COVERAGE_SETTINGS,
        }),
        'math.test.js': '',
    });
    const session = await openSession(sandbox.path);
    const planned = planChecks(session, { stage: 'push', only: ['vitest/coverage'] })[0]!;
    const provider = planned.scope.configurations
        .flatMap((configuration) => configuration.tools)
        .find((tool) => tool.name === '@vitest/coverage-v8')!;
    const check = { ...planned.check, tool: 'eslint' };
    const scope = {
        ...planned.scope,
        configurations: planned.scope.configurations.map((configuration) =>
            configuration.name === 'vitest'
                ? {
                      ...configuration,
                      checks: configuration.checks.map((each) => (each === planned.check ? check : each)),
                      tools: [...configuration.tools, { ...provider, name: 'independent-support' }],
                      eslint: { ...configuration.eslint, required_tools: ['independent-support'] },
                  }
                : configuration,
        ),
    };
    const companions = listOtherTools(scope, check, ['vitest', 'run']);
    expect(companions).toStrictEqual([...INDEPENDENT_LIBRARIES]);
});

test('a check installs the peer packages required by its tool', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['data-files']), 'config.json': '{}\n' });
    const planned = planChecks(await openSession(sandbox.path), { stage: 'push', only: ['data-files/v8r'] });
    expect(planned.map((check) => ({ check: check.check.id, tools: listCheckTools(check) }))).toStrictEqual([
        { check: 'data-files/v8r', tools: ['v8r', 'node', 'ajv'] },
    ]);
});

test('Prettier plugins join the selected tools even though checks do not name them', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['astro', 'svelte']),
        'page.astro': '<p>Page</p>\n',
        'Page.svelte': '<p>Page</p>\n',
    });
    const session = await openSession(sandbox.path);
    expect(
        session.toolConfigurations
            .flatMap(({ tools }) => tools.filter(({ prettier }) => prettier !== undefined).map(({ name }) => name))
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['prettier-plugin-astro', 'prettier-plugin-svelte']);
});
