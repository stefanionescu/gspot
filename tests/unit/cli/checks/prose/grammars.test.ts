import { describe, expect, test } from 'bun:test';
import { PROSE_FORMATS } from '#cli/configurations/vale.ts';
import { routeFor, routeGroups } from '#cli/checks/prose/grammars.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';

function tracked(path: string, tags: string[] = ['text']): TrackedFile {
    return { path, prefix: Buffer.alloc(0), nature: 'source', tags, executable: false, size: 1 };
}

describe('prose routes', () => {
    test('every language goes by its own extension; only an extensionless script reads through stdin as Python', () => {
        expect(routeFor(tracked('a.md'))).toStrictEqual({ path: 'a.md', mode: 'path', extension: '.md' });
        expect(routeFor(tracked('a.tsx'))).toStrictEqual({ path: 'a.tsx', mode: 'path', extension: '.ts' });
        expect(routeFor(tracked('a.sh'))).toStrictEqual({ path: 'a.sh', mode: 'path', extension: '.sh' });
        expect(routeFor(tracked('a.sql'))).toStrictEqual({ path: 'a.sql', mode: 'path', extension: '.sql' });
        expect(routeFor(tracked('a.py'))).toStrictEqual({ path: 'a.py', mode: 'path', extension: '.py' });
        expect(routeFor(tracked('a.css'))).toStrictEqual({ path: 'a.css', mode: 'path', extension: '.css' });
        expect(routeFor(tracked('hooks/pre-commit', ['shell', 'text']))).toStrictEqual({
            path: 'hooks/pre-commit',
            mode: 'stdin',
            extension: '.py',
        });
        expect(routeFor(tracked('a.png'))).toBeUndefined();
    });

    test('a borrowed format maps each extension Vale does not know to one it does', () => {
        expect(PROSE_FORMATS).toStrictEqual([
            ['sh', 'py'],
            ['bash', 'py'],
            ['zsh', 'py'],
            ['sql', 'lua'],
            ['pgsql', 'lua'],
            ['psql', 'lua'],
        ]);
    });

    test('path routes group by extension and an extensionless script stands alone', () => {
        const groups = routeGroups([
            tracked('a.md'),
            tracked('b.md'),
            tracked('c.ts'),
            tracked('d.sh'),
            tracked('e.sh'),
            tracked('hooks/pre-commit', ['shell', 'text']),
        ]);
        expect(groups.map((group) => group.map((route) => route.path))).toStrictEqual([
            ['a.md', 'b.md'],
            ['c.ts'],
            ['d.sh', 'e.sh'],
            ['hooks/pre-commit'],
        ]);
    });
});
