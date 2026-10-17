/** Quotes, parameter modifiers, and escaped hashes remain code. */
export const BASH_COMMENT_CASES = [
    ['echo "a # b" # c', 'echo "a # b"'],
    ["printf '#'", "printf '#'"],
    ['test $# -eq 0 # no arguments', 'test $# -eq 0'],
    ['echo ${#name} a#b # comment', 'echo ${#name} a#b'],
    [String.raw`echo '\' # comment`, String.raw`echo '\'`],
    [String.raw`x=1 \# y`, String.raw`x=1 \# y`],
] as const;

/** Only a trap that removes the same mktemp path counts; other paths, reassignment, and compound values do not. */
export const MKTEMP_CLEANUP_CASES = [
    {
        source: 'tmp=$(mktemp)\ntrap \'tmp=/etc; rm -rf "$tmp"\' EXIT\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        source: 'tmp=$(mktemp)\ntrap \'rm -rf "$tmp"\' EXIT; rm -rf /etc\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        source: "tmp=$(mktemp)\ntrap 'rm -rf \"$tmp\"' EXIT; trap 'rm -rf /etc' HUP\n",
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        source: `tmp=$(mktemp)
change() { tmp=/etc; }
trap 'rm -rf "$tmp"' EXIT
`,
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        source: 'tmp=$(mktemp)\ncleanup() { local tmp; trap \'rm -rf "$tmp"\' RETURN; }\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        source: 'tmp=$(mktemp)\ncleanup() { trap \'rm -rf "$tmp"\' RETURN; }\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [2] }],
    },
    {
        source: 'tmp=$(mktemp -d)\ntrap \'rm -rf -- "$tmp"\' EXIT\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [2] }],
    },
    {
        source: 'tmp="$(mktemp -d)"\ntrap \'rm -rf "${tmp}"\' EXIT\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [2] }],
    },
    {
        source: `tmp=$(mktemp -d)
trap '
rm -rf "$tmp"
' EXIT
`,
        expected: [{ name: 'tmp', line: 1, cleanupLines: [3] }],
    },
    {
        source: 'tmp=$(mktemp -d)\ntrap \'rm -rf "$tmp" /etc\' EXIT\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        source: 'tmp=$(mktemp -d)\ntrap \'rm -rf "$tmp"; rm -rf /etc\' EXIT\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        source: 'tmp=$(mktemp -d)\ntrap \'rm -rf -- "$tmp" -other\' EXIT\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        source: `tmp=$(mktemp -d)
tmp=/etc
trap 'rm -rf "$tmp"' EXIT
`,
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    { source: 'tmp="prefix$(mktemp -d)"\ntrap \'rm -rf "$tmp"\' EXIT\n', expected: [] },
    { source: 'tmp=$(mktemp -d; printf /etc)\ntrap \'rm -rf "$tmp"\' EXIT\n', expected: [] },
    {
        source: `first() { local tmp=$(mktemp); trap 'rm -rf "$tmp"' RETURN; }
second() { local tmp=$(mktemp); trap 'rm -rf "$tmp"' RETURN; }
`,
        expected: [
            { name: 'tmp', line: 1, cleanupLines: [1] },
            { name: 'tmp', line: 2, cleanupLines: [2] },
        ],
    },
] as const;
