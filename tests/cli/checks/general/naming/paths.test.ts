import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { MIGRATION_NAMING_FILES } from '#tests/config/cli/checks/naming.ts';
import { fileIdentifier, directoryIdentifiers } from '#cli/checks/general/naming/contracts.ts';

describe('path identifiers', () => {
    test('the stem drops one extension, or the whole declaration suffix', () => {
        expect(fileIdentifier('src/a-b.test.ts', 'typescript', []).name).toBe('a-b.test');
        expect(fileIdentifier('types/modules.d.ts', 'typescript', []).name).toBe('modules');
        expect(fileIdentifier('db/20240101010101_add_users.sql', 'sql', []).name).toBe('20240101010101_add_users.sql');
    });

    test('Next.js segments are unwrapped and dot folders skipped', () => {
        const containers = configurationManifests().get('nextjs')!.naming!.path_containers;
        const names = directoryIdentifiers(
            'app/(marketing)/[slug]/@modal/_lib/.hidden/page.tsx',
            'typescript',
            containers,
        );
        expect(names.map((entry) => `${entry.category}:${entry.name}`)).toStrictEqual([
            'directories:app',
            'directories:marketing',
            'path_parameters:slug',
            'directories:modal',
            'directories:lib',
        ]);
        expect(names[2]?.directory).toBe('app/(marketing)/[slug]');
        expect(fileIdentifier('app/[...rest]/page.tsx', 'typescript', containers)).toMatchObject({
            name: 'page',
            category: 'files',
        });
    });
});

test.each(['', 'app'])(
    'Postgres migration directory digits in "%s" require its selected declaration',
    async (scope) => {
        await using sandbox = await testdir();
        const prefix = scope === '' ? '' : `${scope}/`;
        for (const [path, text] of Object.entries(MIGRATION_NAMING_FILES))
            await createFileTree(sandbox.path, { [`${prefix}${path}`]: text });
        const policy = buildPolicy(['naming', 'sql'], { level: 'all', tables: '[scope."app"]\n' });
        await writeFile(join(sandbox.path, 'gspot.toml'), policy);
        const first = buildCheckInput(await openSession(sandbox.path), 'naming/paths', { scope });
        const refused = await BUILT_IN_CHECKS['naming/paths'].input(first);
        expect(
            (Array.isArray(refused) ? refused : refused.findings)
                .filter(({ rule }) => rule === 'digits')
                .map(({ file }) => file),
        ).toStrictEqual(Object.keys(MIGRATION_NAMING_FILES).map((path) => `${prefix}${path}`));
        await writeFile(
            join(sandbox.path, 'gspot.toml'),
            buildPolicy(['naming', 'postgres'], { level: 'all', tables: '[scope."app"]\n' }),
        );
        const corrected = buildCheckInput(await openSession(sandbox.path), 'naming/paths', { scope });
        const allowed = await BUILT_IN_CHECKS['naming/paths'].input(corrected);
        expect(
            (Array.isArray(allowed) ? allowed : allowed.findings)
                .filter(({ rule }) => rule === 'digits')
                .map(({ file }) => file),
        ).toStrictEqual([`${prefix}other/20240101000000_create_teams/query.sql`]);
    },
);
test.each(['nextjs', 'svelte', 'astro'])('%s owns route punctuation without changing plain paths', (framework) => {
    const containers = configurationManifests().get(framework)!.naming!.path_containers;
    expect(fileIdentifier('app/[...slug].ts', 'typescript', containers)).toMatchObject({
        name: 'slug',
        category: 'path_parameters',
    });
    for (const name of ['(group)', '@slot', '_private'])
        expect(fileIdentifier(`app/${name}.ts`, 'typescript', containers)).toMatchObject({ name, category: 'files' });
    expect(fileIdentifier('app/[slug].ts', 'typescript', [])).toMatchObject({ name: '[slug]', category: 'files' });
    expect(
        directoryIdentifiers('app/(group)/@slot/_private/[id]/page.ts', 'typescript', []).map(({ name }) => name),
    ).toStrictEqual(['app', '(group)', '@slot', '_private', '[id]']);
});
