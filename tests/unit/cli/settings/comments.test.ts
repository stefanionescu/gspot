import { test, expect } from 'bun:test';
import { parseTomlText } from '#cli/settings/file.ts';
import { formatSettingsText } from '#cli/settings/write/text.ts';
import { ARRAY_COMMENT_CASES } from '#tests/config/settings/comments/arrays.ts';
import { FIELD_COMMENT_CASES } from '#tests/config/settings/comments/fields.ts';
import { IGNORE_COMMENT_CASES } from '#tests/config/settings/comments/ignores.ts';

test.each([...IGNORE_COMMENT_CASES, ...ARRAY_COMMENT_CASES, ...FIELD_COMMENT_CASES])(
    'writing $name gives the same text twice in a row',
    (row) => {
        const { source, expected } = row;
        const target = 'target' in row ? row.target : source;
        const output = formatSettingsText(source, parseTomlText(target, 'target.toml', 'settings'));
        expect(output).toBe(expected);
        expect(formatSettingsText(output, parseTomlText(output, 'gspot.toml', 'settings'))).toBe(expected);
    },
);
