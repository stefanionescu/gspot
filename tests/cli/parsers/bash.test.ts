import { test, expect } from 'bun:test';
import { codeLines, parseBashScript } from '#cli/parsers/bash.ts';
import { COMMENT_CASES, TEMPORARY_CASES } from '#tests/config/cli/parsers/bash.ts';

test.each(COMMENT_CASES)('Bash comments preserve quoted and parameter hashes in %s', async (source, expected) => {
    const parsed = await parseBashScript(source, { minimumStatements: undefined });
    expect(codeLines(parsed.code)).toStrictEqual([{ number: 1, code: expected }]);
});

test('masked comments retain code line numbers and omit blank lines', async () => {
    const parsed = await parseBashScript('\n# note\na=1 # b\n  ', { minimumStatements: undefined });
    expect(codeLines(parsed.code)).toStrictEqual([{ number: 3, code: 'a=1' }]);
});

test.each(TEMPORARY_CASES)(
    'native Bash syntax resolves only exact temporary cleanup paths in $source',
    async ({ source, expected }) => {
        const parsed = await parseBashScript(source, { minimumStatements: undefined });
        expect(parsed.temporaryPaths).toStrictEqual(expected);
    },
);

test('Bash functions retain source ranges, bodies, statements, and positional reads', async () => {
    const parsed = await parseBashScript(
        '#!/usr/bin/env bash\n_one() {\n    echo 1\n}\n\nmain() {\n    _one "$@"\n}\n',
        { minimumStatements: undefined },
    );
    expect(parsed.functions).toStrictEqual([
        { name: '_one', start: 2, end: 4, body: ['', '    echo 1', ''], statements: 1, highestRead: 0 },
        {
            name: 'main',
            start: 6,
            end: 8,
            body: ['', '    _one "$@"', ''],
            statements: 1,
            highestRead: Number.POSITIVE_INFINITY,
        },
    ]);
    expect(parsed.calls).toStrictEqual([
        { name: 'echo', count: 1, line: 3 },
        { name: '_one', count: 1, line: 7 },
    ]);
});

test('Bash one-line functions distinguish owned parameters from nested functions and quoted command arguments', async () => {
    const parsed = await parseBashScript(
        'outer() { inner() { printf "%s" "$9"; }; printf "%s" "$2"; }\nmain() { outer "two words" --flag; }\n',
        { minimumStatements: 2 },
    );
    expect(parsed.functions.map(({ name, highestRead }) => ({ name, highestRead }))).toStrictEqual([
        { name: 'outer', highestRead: 2 },
        { name: 'inner', highestRead: 9 },
        { name: 'main', highestRead: 0 },
    ]);
    expect(parsed.calls).toContainEqual({ name: 'outer', count: 2, line: 2 });
});
