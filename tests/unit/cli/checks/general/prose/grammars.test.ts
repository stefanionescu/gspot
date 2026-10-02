import { test, expect, describe } from 'bun:test';
import { trackedFile } from '#tests/harness/cli/tracked.ts';
import { routeFor, routeGroups } from '#cli/checks/general/prose/vale.ts';

describe('prose routes', () => {
    test('known grammars read paths while module aliases and extensionless scripts use typed stdin', () => {
        expect(routeFor(trackedFile('a.md'))).toStrictEqual({ path: 'a.md', mode: 'path', extension: '.md' });
        expect(routeFor(trackedFile('a.tsx'))).toStrictEqual({ path: 'a.tsx', mode: 'path', extension: '.ts' });
        expect(routeFor(trackedFile('a.sh'))).toStrictEqual({ path: 'a.sh', mode: 'path', extension: '.sh' });
        expect(routeFor(trackedFile('a.sql'))).toStrictEqual({ path: 'a.sql', mode: 'path', extension: '.sql' });
        expect(routeFor(trackedFile('a.py'))).toStrictEqual({ path: 'a.py', mode: 'path', extension: '.py' });
        expect(routeFor(trackedFile('a.css'))).toStrictEqual({ path: 'a.css', mode: 'path', extension: '.css' });
        expect(routeFor(trackedFile('a.mts'))).toStrictEqual({ path: 'a.mts', mode: 'stdin', extension: '.ts' });
        expect(routeFor(trackedFile('a.cjs'))).toStrictEqual({ path: 'a.cjs', mode: 'stdin', extension: '.js' });
        expect(routeFor(trackedFile('hooks/pre-commit', ['shell', 'text']))).toStrictEqual({
            path: 'hooks/pre-commit',
            mode: 'stdin',
            extension: '.py',
        });
        expect(routeFor(trackedFile('a.png'))).toBeUndefined();
    });

    test('path routes group by extension and an extensionless script stands alone', () => {
        const groups = routeGroups([
            trackedFile('a.md'),
            trackedFile('b.md'),
            trackedFile('c.ts'),
            trackedFile('d.sh'),
            trackedFile('e.sh'),
            trackedFile('hooks/pre-commit', ['shell', 'text']),
        ]);
        const paths = [];
        for (const group of groups) paths.push(group.map((route) => route.path));
        expect(paths).toStrictEqual([['a.md', 'b.md'], ['c.ts'], ['d.sh', 'e.sh'], ['hooks/pre-commit']]);
    });
});
