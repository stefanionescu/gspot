import { routeFor, routeGroups } from '#cli/checks/prose/grammars.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
import { describe, expect, test } from 'bun:test';

function tracked(path: string, tags: string[] = ['text']): TrackedFile {
    return { path, prefix: Buffer.alloc(0), nature: 'source', tags, executable: false, size: 1 };
}

describe('prose routes', () => {
    test('Markdown, TypeScript and Swift go by path; shell and SQL through stdin under look-alike grammars', () => {
        expect(routeFor(tracked('a.md'))).toStrictEqual({ path: 'a.md', mode: 'path', extension: '.md' });
        expect(routeFor(tracked('a.tsx'))).toStrictEqual({ path: 'a.tsx', mode: 'path', extension: '.ts' });
        expect(routeFor(tracked('a.sh'))).toStrictEqual({ path: 'a.sh', mode: 'stdin', extension: '.rb' });
        expect(routeFor(tracked('a.sql'))).toStrictEqual({ path: 'a.sql', mode: 'stdin', extension: '.lua' });
        expect(routeFor(tracked('hooks/pre-commit', ['shell', 'text']))?.extension).toBe('.rb');
        expect(routeFor(tracked('a.png'))).toBeUndefined();
    });

    test('path routes group by extension and stdin routes stand alone', () => {
        const groups = routeGroups([
            tracked('a.md'),
            tracked('b.md'),
            tracked('c.ts'),
            tracked('d.sh'),
            tracked('e.sh'),
        ]);
        expect(groups.map((group) => group.map((route) => route.path))).toStrictEqual([
            ['a.md', 'b.md'],
            ['c.ts'],
            ['d.sh'],
            ['e.sh'],
        ]);
    });
});
