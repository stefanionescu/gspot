import { FIRST_READ } from '#cli/config/rules.ts';
import { test, expect, describe } from 'bun:test';
import { excludeProblems } from '#cli/rules/assemble.ts';

describe('[guides] exclude', () => {
    test('a file path and a category folder are accepted', () => {
        expect(excludeProblems(['code/ACCESSIBILITY.md', 'library'])).toStrictEqual([]);
    });

    test('an entry that matches no rule file names the near match', () => {
        const [problem = ''] = excludeProblems(['code/ACCESIBILITY.md']);
        expect(problem).toContain('matches no rule');
        expect(problem).toContain('code/ACCESSIBILITY.md');
    });

    test('a file every agent opens first cannot be left out, alone or through its folder', () => {
        for (const entry of [...FIRST_READ, 'agent', 'prose']) {
            const [problem = ''] = excludeProblems([entry]);
            expect(problem).toContain('every agent opens first');
        }
    });
});
