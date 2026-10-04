import { test, expect } from 'bun:test';
import { textAtLevel } from '#cli/rules/assemble.ts';

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
