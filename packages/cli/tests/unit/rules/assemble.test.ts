import { describe, expect, test } from 'bun:test';
import { excludeProblems, FIRST_READ } from '#cli/rules/assemble.ts';

describe('[rules] exclude', () => {
    test('a file path and a layer folder are accepted', () => {
        expect(excludeProblems(['general/code/ACCESSIBILITY.md', 'library'])).toEqual([]);
    });

    test('an entry that matches no rule file names the near match', () => {
        const [problem = ''] = excludeProblems(['general/code/ACCESIBILITY.md']);
        expect(problem).toContain('matches no rule file');
        expect(problem).toContain('general/code/ACCESSIBILITY.md');
    });

    test('a file every agent opens first cannot be left out, alone or through its folder', () => {
        for (const entry of [...FIRST_READ, 'general/agent', 'general']) {
            const [problem = ''] = excludeProblems([entry]);
            expect(problem).toContain('every agent opens first');
        }
    });
});
