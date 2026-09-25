import { directoryIdentifiers, fileIdentifier } from '#cli/checks/naming/paths.ts';
import { describe, expect, test } from 'bun:test';

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
