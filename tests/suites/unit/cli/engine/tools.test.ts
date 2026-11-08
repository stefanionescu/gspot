import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { planChecks } from '#cli/engine/plan.ts';
import { openSession } from '#cli/engine/session.ts';
import { listCheckTools, listSecondaryTools } from '#cli/engine/tools.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { compareText } from '#cli/system/text.ts';
import { getTool, listPackagePins } from '#cli/tools/pins.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { Session } from '#cli/types/tools.ts';
import { COVERAGE_PROVIDERS, NODE_REQUIREMENTS, TYPESCRIPT_PIN_CASES } from '#tests/config/engine/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runGitStep } from '#tests/setup/system/git.ts';

test.each([...NODE_REQUIREMENTS])(
    'the tools include Node only when an npm tool needs it: $name',
    async ({ configurations, tables, files, needs, skips }) => {
        await using sandbox = await createGitSandbox({
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
            const sandbox = resources.use(await createGitSandbox({}));
            await createFileTree(sandbox.path, { [file]: '', ['app/' + file]: '' });
            await writeFile(
                join(sandbox.path, 'gspot.toml'),
                buildSandboxSettings(configurations, {
                    scopes: [{ path: 'app', configurations }],
                    tables: `[coverage]\nmin_line_percent = ${String(lines)}\n`,
                }),
            );
            session = await openSession(sandbox.path);
            checks = planChecks(session, { stage: 'push', only: [configuration + '/tests'] });
        });
        afterAll(() => resources.disposeAsync());
        test.each([''])(
            'scope %p needs the coverage provider only above a zero limit and always lists it among the secondary tools',
            (scope) => {
                const check = checks.find((planned) => planned.scope.path === scope)!;
                expect(listCheckTools(check)).toStrictEqual([configuration, ...(lines === 0 ? [] : [provider])]);
                expect(listSecondaryTools(check.scope, check.check, check.check.command)).toStrictEqual([provider]);
            },
        );
    },
);

test('Prettier plugins join the selected tools even though checks do not name them', async () => {
    await using sandbox = await createGitSandbox({
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

test.each([...TYPESCRIPT_PIN_CASES])(
    'the tool project pins the TypeScript of the project for $name: $isProjectPin',
    async ({ files, untracked, isProjectPin }) => {
        await using sandbox = await createGitSandbox({ ...files, 'gspot.toml': buildSandboxSettings(['typescript']) });
        const tracked = ['gspot.toml', ...Object.keys(files)].filter(
            (path) => !(untracked as readonly string[]).includes(path),
        );
        runGitStep(sandbox.path, ['add', '--', ...tracked]);
        const session = await openSession(sandbox.path);
        const expected = isProjectPin ? '6.0.3' : getTool(readConfigurations().values(), 'tsc').version;
        expect(listPackagePins(session.toolConfigurations).npm['typescript']).toBe(expected);
        const [planned] = planChecks(session, { stage: 'push', only: ['typescript/tsc'] });
        expect(planned?.tool?.version).toBe(expected);
    },
);
