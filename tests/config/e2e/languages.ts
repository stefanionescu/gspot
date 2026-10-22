export const PROSE_CHECK = {
    check: 'prose/vale',
    files: {
        'guide.md': `# Schedule

NebulaConfiguration uses Python. Release on 03/04/2026.
`,
    },
    corrected: {
        files: {
            'guide.md': `# Schedule

NebulaConfiguration uses Python. Release on March 4, 2026.
`,
        },
    },
    expected: { file: 'guide.md', line: 3, rule: 'gspot.dates' },
} as const;

export const SWIFT_CHECK = {
    check: 'naming/identifiers',
    files: { 'Account.swift': 'let utils = 1\n' },
    corrected: { files: { 'Account.swift': 'let account = 1\n' } },
    expected: { file: 'Account.swift', line: 1, rule: 'banned-word' },
} as const;
