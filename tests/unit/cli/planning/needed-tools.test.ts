import { join } from 'node:path';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { checkCompanions, requiredToolNames } from '#cli/planning/needed-tools.ts';
import { COVERAGE_LIMITS, NODE_REQUIREMENTS, ARCHITECTURE_REQUIREMENTS } from '#tests/config/planning.ts';

test.each([...NODE_REQUIREMENTS])(
    'the needed tools include Node only when an npm tool needs it: $name',
    async ({ configurations, tables, files, node }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(configurations, { tables }),
            ...files,
        });
        const session = await openSession(sandbox.path);
        const names = session.neededToolManifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name));
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

test('schema tools need their ajv peer', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['files']),
        'settings.json': '{"enabled":true}\n',
    });
    const session = await openSession(sandbox.path);
    const names = session.neededToolManifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name));
    expect(names).toContain('v8r');
    expect(names).toContain('ajv');
});

test.each([...ARCHITECTURE_REQUIREMENTS])(
    'eslint-plugin-boundaries is needed for $name at the levels that use it',
    async ({ tables, boundary }) => {
        for (const level of LEVELS) {
            await using sandbox = await testdir({
                'gspot.toml': settingsText(['javascript'], {
                    level,
                    tables: `${tables}\n[[scope]]\npath = "app"\nconfigurations = ["javascript"]\n`,
                }),
                'src/source.js': 'export const value = 1;\n',
                'app/src/source.js': 'export const value = 2;\n',
            });
            const session = await openSession(sandbox.path);
            expect(session.scopes.map(({ scope }) => scope.path)).toStrictEqual(['', 'app']);
            expect(session.scopes.every(({ view }) => view.test_files.length > 0)).toBe(true);
            const names = session.neededToolManifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name));
            expect(names.includes('eslint-plugin-boundaries')).toBe(boundary[level]);
        }
    },
);

describe.each([...COVERAGE_LIMITS])(
    '$configuration coverage at the $lines limit',
    ({ configuration, provider, file, configurations, lines }) => {
        const resources = new AsyncDisposableStack();
        let session: Session;
        let checks: PlannedCheck[];
        beforeAll(async () => {
            const sandbox = resources.use(await testdir());
            await createFileTree(sandbox.path, { [file]: '', ['app/' + file]: '' });
            const tables = `[coverage]\nlines = ${String(lines)}\n[[scope]]\npath = "app"\nconfigurations = ${JSON.stringify(configurations)}\n`;
            await Bun.write(join(sandbox.path, 'gspot.toml'), settingsText(configurations, { tables }));
            session = await openSession(sandbox.path);
            checks = planRun(session, { stage: 'push', only: [configuration + '/coverage'] });
        });
        afterAll(() => resources.disposeAsync());
        test.each(['', 'app'])('scope %s needs the provider and lists it as a companion', (scope) => {
            const check = checks.find((planned) => planned.scope.scope.path === scope)!;
            expect(requiredToolNames(check).includes(provider)).toBe(lines !== 0);
            expect(checkCompanions(check.scope, check.check, check.check.command)).toContain(provider);
        });
    },
);
