import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { type Session } from '#cli/types/session.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { listOtherTools, listCheckTools } from '#cli/planning/tools.ts';

import {
    NODE_REQUIREMENTS,
    COVERAGE_PROVIDERS,
    INDEPENDENT_LIBRARIES,
    ARCHITECTURE_REQUIREMENTS,
} from '#tests/config/planning/tools.ts';

test.each([...NODE_REQUIREMENTS])(
    'the needed tools include Node only when an npm tool needs it: $name',
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
    'eslint-plugin-boundaries is needed for $name only at the levels that use it: $level',
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
            tables: '[coverage]\nlines = 0\nbranches = 0\nfunctions = 0\nstatements = 0\n',
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
