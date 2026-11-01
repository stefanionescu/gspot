import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { compareText } from '#cli/system/text.ts';
import { testdir, createFileTree } from 'testdirs';
import { planChecks } from '#cli/planning/checks.ts';
import { type Session } from '#cli/types/session.ts';
import { openSession } from '#cli/planning/session.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { listOtherTools, listCheckTools } from '#cli/planning/tools.ts';
import { NODE_REQUIREMENTS, COVERAGE_PROVIDERS } from '#tests/config/planning/planning.ts';

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
            .toSorted(compareText),
    ).toStrictEqual(['prettier-plugin-astro', 'prettier-plugin-svelte']);
});
