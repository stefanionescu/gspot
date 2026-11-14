import { test, expect } from 'bun:test';
import { listCodeLines, parseBashScript } from '#cli/parsers/code/bash/script.ts';

import {
    TRAP_CALLS,
    BASH_FUNCTIONS,
    QUOTED_TRAP_CALLS,
    MKTEMP_CLEANUP_CASES,
    FORWARDING_CALL_CASES,
} from '#tests/config/parsers/code.ts';

const CONTINUED_TRAP_SOURCE = String.raw`tmp=$(mktemp -d)
trap "\
rm -rf -- \"\$tmp\"; \
false || :" EXIT
`;

test('comment masking keeps quoted hashes and line numbers and drops blank lines', async () => {
    const parsed = await parseBashScript('\n# note\necho "a # b" # c\n  ');
    expect(listCodeLines(parsed.code)).toStrictEqual([{ number: 3, text: 'echo "a # b"' }]);
});

test.each([...MKTEMP_CLEANUP_CASES])(
    'only a trap that removes exactly the mktemp path counts as cleanup: $name',
    async ({ source, expected }) => {
        const parsed = await parseBashScript(source);
        const paths = parsed.temporaryPaths.map(({ name, line, cleanupLines }) => ({ name, line, cleanupLines }));
        expect(paths).toStrictEqual(expected);
    },
);

test('Bash functions report their lines, bodies and the highest positional parameter they read', async () => {
    const parsed = await parseBashScript(
        '#!/usr/bin/env bash\n_one() {\n    echo 1\n}\n\nmain() {\n    _one "$@"\n}\n',
    );
    expect(parsed.functions).toStrictEqual(BASH_FUNCTIONS);
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
    expect(parsed.calls).toStrictEqual([
        { name: 'printf', count: 2, line: 1, forwards: false },
        { name: 'printf', count: 2, line: 1, forwards: false },
        { name: 'outer', count: 2, line: 2, forwards: false },
        { name: '--flag', count: 0, line: 2, forwards: false },
    ]);
});

test('literal trap handlers count as calls while trap bodies with expansions stay uninterpreted', async () => {
    const parsed = await parseBashScript('trap _cleanup EXIT\ntrap "_quoted" EXIT\ntrap $handler EXIT\n');
    expect(parsed.calls.filter(({ name }) => name !== 'trap' && name !== 'EXIT')).toStrictEqual([...TRAP_CALLS]);
});

test.each([...QUOTED_TRAP_CALLS])(
    'quoted trap $source keeps literal command argument counts',
    async ({ source, counts }) => {
        const parsed = await parseBashScript(source);
        expect(parsed.calls.filter(({ name }) => name === 'cleanup').map(({ count }) => count)).toStrictEqual([
            ...counts,
        ]);
    },
);

test.each([...FORWARDING_CALL_CASES])(
    'Bash calls mark positional argument forwarding: $source',
    async ({ source, count, forwards }) => {
        const parsed = await parseBashScript(source);
        expect(parsed.calls.filter(({ name }) => name === 'consume')).toStrictEqual([
            { name: 'consume', count, line: 1, forwards },
        ]);
    },
);

test('continued trap commands and cleanup retain their original source rows', async () => {
    const parsed = await parseBashScript(CONTINUED_TRAP_SOURCE);
    expect(parsed.temporaryPaths).toStrictEqual([{ name: 'tmp', line: 1, cleanupLines: [3], removalLines: [] }]);
    expect(parsed.commands.filter(({ name }) => name === 'rm')).toStrictEqual([
        { name: 'rm', arguments: ['-rf', '--', undefined], line: 3 },
    ]);
    expect(parsed.calls.filter(({ name }) => name === 'rm')).toStrictEqual([
        { name: 'rm', count: 3, forwards: false, line: 3 },
    ]);
    expect(parsed.swallowedLines).toStrictEqual([4]);
});

test('a quoted arithmetic expansion is not a literal argument', async () => {
    const parsed = await parseBashScript('echo "$((1 + 2))"\n');
    expect(parsed.commands[0]?.arguments).toStrictEqual([undefined]);
});
