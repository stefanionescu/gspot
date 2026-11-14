import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/engine/session.ts';
import { planChecks } from '#cli/engine/plan/checks.ts';
import { compareText } from '#cli/system/text/order.ts';
import { buildMiseInstall } from '#cli/tools/projects.ts';
import { NODE_REQUIREMENTS } from '#tests/config/engine/plan.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { listCheckTools, listHostCheckTools, listSecondaryTools } from '#cli/engine/plan/tools.ts';

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

test.each([0, 80])(
    'pytest needs its coverage provider only above a zero limit and always lists it among the secondary tools: %d',
    async (lines) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['python', 'pytest'], {
                tables: `[coverage]\nmin_line_percent = ${String(lines)}\n`,
            }),
            'test_math.py': '',
        });
        const session = await openSession(sandbox.path);
        const check = planChecks(session, { stage: 'push', only: ['pytest/tests'] })[0]!;
        expect(listCheckTools(check)).toStrictEqual(['pytest', ...(lines === 0 ? [] : ['pytest-cov'])]);
        expect(listSecondaryTools(check.scope, check.check, check.check.command)).toStrictEqual(['pytest-cov']);
    },
);

test('install adds dotenv-linter once an env file exists, and the mise project pins it either way', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const before = await openSession(sandbox.path);
    await writeFile(join(sandbox.path, '.env.example'), 'API_URL=https://example.com\n');
    const after = await openSession(sandbox.path);
    expect([before, after].map((session) => listHostCheckTools(session).has('dotenv-linter'))).toStrictEqual([
        false,
        true,
    ]);
    const project = buildMiseInstall(after.toolConfigurations).content;
    expect(project).toContain('dotenv-linter');
    expect(buildMiseInstall(before.toolConfigurations).content).toBe(project);
});

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
