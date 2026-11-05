import { expect, test } from 'bun:test';

import { findDocstring, parsePythonModule } from '#cli/parsers/code/python.ts';
import { DOCSTRING_CASES } from '#tests/config/parsers/comments.ts';

test.each(DOCSTRING_CASES)('a Python %p string has docstring value %p', async (prefix, expected) => {
    const parsed = await parsePythonModule('source.py', `def example():\n    ${prefix}"todo"\n    return 1\n`);
    using _tree = parsed.tree;
    expect(findDocstring(parsed.statements[0]!)).toBe(expected);
});
