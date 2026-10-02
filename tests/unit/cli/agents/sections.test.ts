import { test, expect } from 'bun:test';
import { selectedSections } from '#cli/rules/sections.ts';

test('level filtering respects fenced examples, nested sections, and the next peer heading', () => {
    const before = '# Guide\n\n## Required\n\n```md\n## Example\n<!-- level: all -->\n```\n\n';
    const omitted =
        '## Convention\n<!-- level: all -->\n\nContent.\n\n### Detail\n<!-- level: all -->\n\n```md\n## Not a boundary\n```\n\n';
    const after = '## Safety\n\nKeep this requirement.\n';
    const text = before + omitted + after;
    expect(selectedSections(text, 'recommended')).toBe(before + after);
    expect(selectedSections(text, 'all')).toBe(text);
    expect(selectedSections(selectedSections(text, 'recommended'), 'recommended')).toBe(before + after);
});
