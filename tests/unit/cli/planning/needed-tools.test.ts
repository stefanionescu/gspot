import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { type Session } from '#cli/types/session.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { listOtherTools, listNeededTools } from '#cli/planning/needed-tools.ts';
import { NODE_REQUIREMENTS, COVERAGE_PROVIDERS, ARCHITECTURE_REQUIREMENTS } from '#tests/data/runs/plan.ts';

test.each([...NODE_REQUIREMENTS])(
    'the needed tools include Node only when an npm tool needs it: $name',
    async ({ configurations, tables, files, node }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(configurations, { tables }),
            ...files,
        });

        const session = await openSession(sandbox.path);
        const names = session.neededToolConfigurations.flatMap((configuration) =>
            configuration.tools.map((tool) => tool.name),
        );
        expect(names.includes('node')).toBe(node);
        if (new Set<string>(configurations).has('typescript')) {
            expect(names).toContain('eslint');
        } else if (new Set<string>(configurations).has('markdown')) {
            expect(names).toContain('markdownlint-cli2');
        } else {
            expect(names).toContain('ruff');
            expect(names).not.toContain('eslint');
            expect(names).not.toContain('typescript');
        }
    },
);

test.each(ARCHITECTURE_REQUIREMENTS.flatMap((entry) => LEVELS.map((level) => ({ ...entry, level }))))(
    'eslint-plugin-boundaries is needed for $name at the levels that use it (%j)',
    async ({ tables, boundary, level }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript'], {
                level,
                tables: `${tables}\n[[scope]]\npath = "app"\nconfigurations = ["javascript"]\n`,
            }),
            'src/source.js': 'export const value = 1;\n',
            'app/src/source.js': 'export const value = 2;\n',
        });
        const session = await openSession(sandbox.path);
        expect(session.scopes.map(({ folder }) => folder.path)).toStrictEqual(['', 'app']);
        expect(session.scopes.every(({ settings }) => settings.test_files.length > 0)).toBe(true);
        const names = session.neededToolConfigurations.flatMap((configuration) =>
            configuration.tools.map((tool) => tool.name),
        );
        expect(names.includes('eslint-plugin-boundaries')).toBe(boundary[level]);
        const checks = planChecks(session, { stage: 'all', only: ['javascript/eslint'] });
        for (const check of checks) {
            expect(listOtherTools(check.scope, check.check).includes('eslint-plugin-boundaries')).toBe(boundary[level]);
            expect(listNeededTools(check).includes('eslint-plugin-boundaries')).toBe(boundary[level]);
        }
    },
);

describe.each(COVERAGE_PROVIDERS.flatMap((entry) => [0, 80].map((lines) => ({ ...entry, lines }))))(
    '$configuration coverage at the $lines limit',
    ({ configuration, provider, file, configurations, lines }) => {
        const resources = new AsyncDisposableStack();
        let session: Session;
        let checks: PlannedCheck[];
        beforeAll(async () => {
            const sandbox = resources.use(await testdir());
            await createFileTree(sandbox.path, { [file]: '', ['app/' + file]: '' });
            const tables = `[coverage]\nlines = ${String(lines)}\n[[scope]]\npath = "app"\nconfigurations = ${JSON.stringify(configurations)}\n`;
            await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(configurations, { tables }));
            session = await openSession(sandbox.path);
            checks = planChecks(session, { stage: 'push', only: [configuration + '/coverage'] });
        });
        afterAll(() => resources.disposeAsync());
        test.each(['', 'app'])('scope %s needs the provider and lists it as a companion', (scope) => {
            const check = checks.find((planned) => planned.scope.folder.path === scope)!;
            expect(listNeededTools(check).includes(provider)).toBe(lines !== 0);
            expect(listOtherTools(check.scope, check.check, check.check.command)).toContain(provider);
        });
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
                      checks: configuration.checks.map((entry) => (entry === planned.check ? check : entry)),
                      tools: [...configuration.tools, { ...provider, name: 'independent-support' }],
                      eslint: { ...configuration.eslint, required_tools: ['independent-support'] },
                  }
                : configuration,
        ),
    };
    const companions = listOtherTools(scope, check, ['vitest', 'run']);
    expect(companions).toContain('independent-support');
    expect(companions).not.toContain('@vitest/coverage-v8');
});
