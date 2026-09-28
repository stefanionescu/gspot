import { test, expect } from 'bun:test';
import { lintRules } from '#cli/agents/lint.ts';
import { selectedSections } from '#cli/agents/sections.ts';

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

test('named rules follow the same level inventory as generated lint configuration', () => {
    const header = '---\nlayer: language\nconfiguration: react\ntitle: React\n---\n\n# React\n\n';
    const required = '## Rendering\n\nPreserve `react/no-danger-with-children`.\n\n';
    const convention = '## HTML sinks\n\nPreserve `react/no-danger`.\n';
    const path = 'language/REACT.md';
    const rejected = lintRules([{ path, text: header + required + convention }]);
    expect(rejected.findings).toStrictEqual([
        { file: path, line: 15, message: "rule 'react/no-danger' requires an all-level section" },
    ]);
    const corrected = header + required + convention.replace('## HTML sinks\n', '## HTML sinks\n<!-- level: all -->\n');
    expect(lintRules([{ path, text: corrected }]).findings).toStrictEqual([]);
    expect(selectedSections(corrected, 'recommended')).toBe(header + required);
    expect(selectedSections(corrected, 'all')).toBe(corrected);
    const heading = corrected.replace('## HTML sinks', '## `react/no-danger`');
    expect(lintRules([{ path, text: heading }]).findings).toStrictEqual([]);
    const fenced = header + '```ts\nconst rule = `react/no-danger`;\n```\n';
    expect(lintRules([{ path, text: fenced }]).findings).toStrictEqual([]);
});
