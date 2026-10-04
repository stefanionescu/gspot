import { FIRST_READ } from '#cli/config/rules.ts';
import { test, expect, describe } from 'bun:test';
import { excludeProblems } from '#cli/rules/assemble.ts';

describe('[agent_rules] exclude', () => {
    test('a file path and a category folder are accepted', () => {
        expect(excludeProblems(['general/engineering/code/ACCESSIBILITY.md', 'library'])).toStrictEqual([]);
    });

    test('an entry that matches no rule file names the near match', () => {
        const [problem] = excludeProblems(['general/engineering/code/ACCESIBILITY.md']);
        expect(problem).toMatchObject({ index: 0 });
        expect(problem!.message).toContain('matches no rule');
        expect(problem!.message).toContain('general/engineering/code/ACCESSIBILITY.md');
    });

    test('a file every agent opens first cannot be left out, alone or through its folder', () => {
        for (const entry of [...FIRST_READ, 'general/engineering/agent', 'general/engineering/prose']) {
            const [problem] = excludeProblems([entry]);
            expect(problem!.message).toContain('every agent opens first');
        }
    });
});
