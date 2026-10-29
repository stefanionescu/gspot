export const BASH_COMMENT_CASES = [
    ['echo "a # b" # c', 'echo "a # b"'],
    ["printf '#'", "printf '#'"],
    ['test $# -eq 0 # no arguments', 'test $# -eq 0'],
    ['echo ${#name} a#b # comment', 'echo ${#name} a#b'],
    [String.raw`echo '\' # comment`, String.raw`echo '\'`],
    [String.raw`x=1 \# y`, String.raw`x=1 \# y`],
] as const;

export const MKTEMP_CLEANUP_CASES = [
    {
        name: 'a literal double-quoted cleanup with escaped quotes and a delayed variable',
        source: String.raw`tmp=$(mktemp)
trap "rm -f \"\$tmp\"" EXIT
`,
        expected: [{ name: 'tmp', line: 1, cleanupLines: [2] }],
    },
    {
        name: 'a trap that changes the path before it removes it',
        source: 'tmp=$(mktemp)\ntrap \'tmp=/etc; rm -rf "$tmp"\' EXIT\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        name: 'a trap with a second removal after it on its line',
        source: 'tmp=$(mktemp)\ntrap \'rm -rf "$tmp"\' EXIT; rm -rf /etc\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        name: 'a second trap that removes another path',
        source: "tmp=$(mktemp)\ntrap 'rm -rf \"$tmp\"' EXIT; trap 'rm -rf /etc' HUP\n",
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        name: 'a function that changes the path',
        source: `tmp=$(mktemp)
change() { tmp=/etc; }
trap 'rm -rf "$tmp"' EXIT
`,
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        name: 'a function trap on a local variable of the same name',
        source: 'tmp=$(mktemp)\ncleanup() { local tmp; trap \'rm -rf "$tmp"\' RETURN; }\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        name: 'a function trap that removes the path',
        source: 'tmp=$(mktemp)\ncleanup() { trap \'rm -rf "$tmp"\' RETURN; }\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [2] }],
    },
    {
        name: 'a trap with -- before the path',
        source: 'tmp=$(mktemp -d)\ntrap \'rm -rf -- "$tmp"\' EXIT\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [2] }],
    },
    {
        name: 'a braced path in quotes',
        source: 'tmp="$(mktemp -d)"\ntrap \'rm -rf "${tmp}"\' EXIT\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [2] }],
    },
    {
        name: 'a trap body over several lines',
        source: `tmp=$(mktemp -d)
trap '
rm -rf "$tmp"
' EXIT
`,
        expected: [{ name: 'tmp', line: 1, cleanupLines: [3] }],
    },
    {
        name: 'a trap that removes another path too',
        source: 'tmp=$(mktemp -d)\ntrap \'rm -rf "$tmp" /etc\' EXIT\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        name: 'a trap with a second command',
        source: 'tmp=$(mktemp -d)\ntrap \'rm -rf "$tmp"; rm -rf /etc\' EXIT\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        name: 'a trap with an argument after the path',
        source: 'tmp=$(mktemp -d)\ntrap \'rm -rf -- "$tmp" -other\' EXIT\n',
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        name: 'a path changed between mktemp and the trap',
        source: `tmp=$(mktemp -d)
tmp=/etc
trap 'rm -rf "$tmp"' EXIT
`,
        expected: [{ name: 'tmp', line: 1, cleanupLines: [] }],
    },
    {
        name: 'a path with a prefix before mktemp',
        source: 'tmp="prefix$(mktemp -d)"\ntrap \'rm -rf "$tmp"\' EXIT\n',
        expected: [],
    },
    {
        name: 'a substitution with a second command',
        source: 'tmp=$(mktemp -d; printf /etc)\ntrap \'rm -rf "$tmp"\' EXIT\n',
        expected: [],
    },
    {
        name: 'two functions with their own paths',
        source: `first() { local tmp=$(mktemp); trap 'rm -rf "$tmp"' RETURN; }
second() { local tmp=$(mktemp); trap 'rm -rf "$tmp"' RETURN; }
`,
        expected: [
            { name: 'tmp', line: 1, cleanupLines: [1] },
            { name: 'tmp', line: 2, cleanupLines: [2] },
        ],
    },
];

export const FORWARDING_CALL_CASES = [
    { source: 'consume "$@"\n', count: 1, forwards: true },
    { source: 'consume "$*"\n', count: 1, forwards: true },
    { source: 'consume one "$@"\n', count: 2, forwards: true },
    { source: "consume '$@'\n", count: 1, forwards: false },
    { source: String.raw`consume "\$@"` + '\n', count: 1, forwards: false },
    { source: 'consume "$#"\n', count: 1, forwards: false },
    { source: 'consume "$1"\n', count: 1, forwards: false },
    { source: 'consume\n', count: 0, forwards: false },
] as const;

export const TRAP_CALLS = [
    { name: 'trap', count: 2, line: 1, forwards: false },
    { name: '_cleanup', count: 0, line: 1, forwards: false },
    { name: 'EXIT', count: 0, line: 1, forwards: false },
    { name: 'trap', count: 2, line: 2, forwards: false },
    { name: 'EXIT', count: 0, line: 2, forwards: false },
    { name: '_quoted', count: 0, line: 2, forwards: false },
    { name: 'trap', count: 2, line: 3, forwards: false },
    { name: 'EXIT', count: 0, line: 3, forwards: false },
] as const;

export const QUOTED_TRAP_CALLS = [
    { source: `trap 'cleanup one "two words"' EXIT\n`, counts: [2] },
    { source: String.raw`trap "cleanup \"two words\"" EXIT`, counts: [1] },
    { source: String.raw`trap "cleanup \$value" EXIT`, counts: [1] },
    { source: 'trap "cleanup $value" EXIT', counts: [] },
    { source: 'trap "cleanup $(name)" EXIT', counts: [] },
] as const;

export const BASH_FUNCTIONS = [
    {
        name: '_one',
        start: 2,
        end: 4,
        highestRead: 0,
        branches: 0,
        nesting: 0,
        assignments: 0,
    },
    {
        name: 'main',
        start: 6,
        end: 8,
        highestRead: Infinity,
        branches: 0,
        nesting: 0,
        assignments: 0,
    },
];

export const CONTINUED_TRAP_SOURCE = String.raw`tmp=$(mktemp -d)
trap "\
rm -rf -- \"\$tmp\"; \
false || :" EXIT
`;
