export const SWIFT_IGNORE_FOLDERS = ['.build/', 'DerivedData/', 'Pods/'] as const;

export const SEMGREP_IGNORE_CASES = [
    {
        name: 'identical scope ignores reuse the root file',
        configurations: ['bash'],
        tables: `[[scope]]
path = "first"

[[scope]]
path = "second"

`,
        sources: { 'sample.sh': 'echo sample\n' },
        paths: ['.semgrepignore'],
        swift: false,
        patterns: [],
    },
    {
        name: 'custom scope ignores retain the relative pattern',
        configurations: ['bash'],
        tables: `[[scope]]
path = "child"

[[ignore]]
check = "security/semgrep"
paths = ["child/legacy/**"]
reason = "Reviewed legacy scripts are maintained separately."
`,
        sources: { 'sample.sh': 'echo sample\n', 'child/legacy/script.sh': 'echo legacy\n' },
        paths: ['.semgrepignore', 'child/.semgrepignore'],
        swift: false,
        patterns: [{ path: 'child/.semgrepignore', text: 'legacy/**' }],
    },
    {
        name: 'Swift selection adds its ignored build folders',
        configurations: ['swift'],
        tables: '',
        sources: { 'example.swift': 'let value = 1\n' },
        paths: ['.semgrepignore'],
        swift: true,
        patterns: [],
    },
] as const;

/** Native rule match and partial source parse error from the pinned Semgrep JSON contract. */
export const SEMGREP_MATCH = {
    check_id: 'gspot.bash.eval',
    path: 'scripts/café build.sh',
    start: { line: 2, col: 1 },
    extra: { message: 'eval runs a string as code.' },
} as const;

export const SEMGREP_PARSE_ERROR = {
    code: 3,
    type: ['PartialParsing', []],
    message: 'Syntax error in source.',
    path: 'scripts/café build.sh',
    spans: [{ file: 'scripts/café build.sh', start: { line: 1, col: 1 } }],
} as const;
