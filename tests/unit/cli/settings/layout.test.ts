import { test, expect } from 'bun:test';
import { emitSettings, parseTomlText } from '#cli/settings/file.ts';
import { LAYOUT_CASES, INLINE_FIELD_COMMENT } from '#tests/config/settings/layout.ts';

test('a comment on a field in an inline table inside a mixed array cannot be written', () => {
    const written = parseTomlText(INLINE_FIELD_COMMENT, 'gspot.toml', 'settings');
    expect(() => emitSettings(INLINE_FIELD_COMMENT, written)).toThrow(
        'The comment for tools.eslint.extra.value.mixed.0.enabled cannot be represented in TOML 1.0.',
    );
});
test.each([...LAYOUT_CASES])('writing $name gives the same text twice in a row', (row) => {
    const { source, expected } = row;
    const target = 'target' in row ? row.target : source;
    const written = parseTomlText(target, 'target.toml', 'settings');
    const output = emitSettings(source, written);
    const rewritten = parseTomlText(output, 'gspot.toml', 'settings');
    expect(output).toBe(expected);
    expect(emitSettings(output, rewritten)).toBe(expected);
});
