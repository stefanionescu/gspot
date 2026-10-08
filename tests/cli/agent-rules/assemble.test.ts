import { test, expect, describe } from 'bun:test';
import { textAtLevel } from '#cli/agent-rules/assemble.ts';
import { FIRST_READ } from '#cli/config/policy/settings.ts';
import { excludeErrors } from '#cli/policy/errors/selection.ts';

describe('[agent_rules] exclude', () => {
    test('a file path and a category folder are accepted', () => {
        expect(excludeErrors(['general/engineering/code/ACCESSIBILITY.md', 'library'])).toStrictEqual([]);
    });

    test('an entry that matches no rule file names the near match', () => {
        const [problem] = excludeErrors(['general/engineering/code/ACCESIBILITY.md']);
        expect(problem).toMatchObject({ index: 0 });
        expect(problem!.message).toContain('matches no rule');
        expect(problem!.message).toContain('general/engineering/code/ACCESSIBILITY.md');
    });

    test.each([...FIRST_READ, 'general/engineering/agent', 'general/engineering/prose'])(
        'the required first-read entry %s cannot be left out',
        (entry) => {
            const [problem] = excludeErrors([entry]);
            expect(problem!.message).toContain('every agent opens first');
        },
    );
});

test('level filtering respects fenced examples, nested sections, and the next peer heading', () => {
    const before = '# Guide\n\n## Required\n\n```md\n## Example\n<!-- level: all -->\n```\n\n';
    const omitted =
        '## Convention\n<!-- level: all -->\n\nContent.\n\n### Detail\n<!-- level: all -->\n\n```md\n## Not a boundary\n```\n\n';
    const after = '## Safety\n\nKeep this requirement.\n';
    const text = before + omitted + after;
    expect(textAtLevel(text, 'recommended')).toBe(before + after);
    expect(textAtLevel(text, 'all')).toBe(text);
    expect(textAtLevel(textAtLevel(text, 'recommended'), 'recommended')).toBe(before + after);
});
