import { test, expect } from 'bun:test';
import { listCodeLines, parseBashScript } from '#cli/parsers/code/bash.ts';

import {
    TRAP_CALLS,
    BASH_FUNCTIONS,
    BASH_COMMENT_CASES,
    MKTEMP_CLEANUP_CASES,
    FORWARDING_CALL_CASES,
} from '#tests/config/parsers/code/bash.ts';

test.each(BASH_COMMENT_CASES)(
    'Bash comments keep quoted and parameter hashes as code: %s',
    async (source, expected) => {
        const parsed = await parseBashScript(source);
        expect(listCodeLines(parsed.code)).toStrictEqual([{ number: 1, text: expected }]);
    },
);

test('comment masking keeps line numbers and drops blank lines', async () => {
    const parsed = await parseBashScript('\n# note\na=1 # b\n  ');
    expect(listCodeLines(parsed.code)).toStrictEqual([{ number: 3, text: 'a=1' }]);
});

test.each([...MKTEMP_CLEANUP_CASES])(
    'only a trap that removes exactly the mktemp path counts as cleanup: $name',
    async ({ source, expected }) => {
        const parsed = await parseBashScript(source);
        expect(parsed.temporaryPaths).toStrictEqual(expected);
    },
);

test('Bash functions report their lines, bodies and the highest positional parameter they read', async () => {
    const parsed = await parseBashScript(
        '#!/usr/bin/env bash\n_one() {\n    echo 1\n}\n\nmain() {\n    _one "$@"\n}\n',
    );
    expect(parsed.functions).toStrictEqual([
        BASH_FUNCTIONS,
        {
            name: 'main',
            start: 6,
            end: 8,
            body: ['', '    _one "$@"', ''],
            highestRead: Number.POSITIVE_INFINITY,
            branches: 0,
            nesting: 0,
            assignments: 0,
        },
    ]);
    expect(parsed.calls).toStrictEqual([
        { name: 'echo', count: 1, line: 3, forwards: false },
        { name: '_one', count: 1, line: 7, forwards: true },
    ]);
});

test('one-line Bash functions count only their own parameters, not those of nested functions', async () => {
    const parsed = await parseBashScript(
        'outer() { inner() { printf "%s" "$9"; }; printf "%s" "$2"; }\nmain() { outer "two words" --flag; }\n',
    );
    expect(parsed.functions.map(({ name, highestRead }) => ({ name, highestRead }))).toStrictEqual([
        { name: 'outer', highestRead: 2 },
        { name: 'inner', highestRead: 9 },
        { name: 'main', highestRead: 0 },
    ]);
    expect(parsed.calls).toContainEqual({ name: 'outer', count: 2, line: 2, forwards: false });
});

test('plain trap handlers count as zero-argument calls while quoted and expanded trap bodies stay uninterpreted', async () => {
    const parsed = await parseBashScript('trap _cleanup EXIT\ntrap "_quoted" EXIT\ntrap $handler EXIT\n');
    expect(parsed.calls).toStrictEqual([...TRAP_CALLS]);
});

test.each([...FORWARDING_CALL_CASES])(
    'Bash calls mark positional argument forwarding: $source',
    async ({ source, count, forwards }) => {
        const parsed = await parseBashScript(source);
        expect(parsed.calls).toStrictEqual([{ name: 'consume', count, line: 1, forwards }]);
    },
);
