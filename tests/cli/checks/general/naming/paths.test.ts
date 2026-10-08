import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { MIGRATION_NAMING_FILES } from '#tests/config/cli/checks/naming.ts';
import { namingPaths, fileIdentifier, directoryIdentifiers } from '#cli/checks/general/naming/identifiers.ts';

describe('path identifiers', () => {
    test('the stem drops one extension, or the whole declaration suffix', () => {
        expect(fileIdentifier('src/a-b.test.ts', 'typescript').name).toBe('a-b.test');
        expect(fileIdentifier('types/modules.d.ts', 'typescript').name).toBe('modules');
        expect(fileIdentifier('db/20240101010101_add_users.sql', 'sql').name).toBe('20240101010101_add_users.sql');
    });

    test('Next.js segments are unwrapped and dot folders skipped', () => {
        const names = directoryIdentifiers('app/(marketing)/[slug]/@modal/_lib/.hidden/page.tsx', 'typescript');
        expect(names.map((entry) => `${entry.category}:${entry.name}`)).toStrictEqual([
            'directories:app',
            'directories:marketing',
            'path_parameters:slug',
            'directories:modal',
            'directories:lib',
        ]);
        expect(names[2]?.directory).toBe('app/(marketing)/[slug]');
        expect(fileIdentifier('app/[...rest]/page.tsx', 'typescript')).toMatchObject({
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
        const refused = await namingPaths(first);
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
        const allowed = await namingPaths(corrected);
        expect(
            (Array.isArray(allowed) ? allowed : allowed.findings)
                .filter(({ rule }) => rule === 'digits')
                .map(({ file }) => file),
        ).toStrictEqual([`${prefix}other/20240101000000_create_teams/query.sql`]);
    },
);
