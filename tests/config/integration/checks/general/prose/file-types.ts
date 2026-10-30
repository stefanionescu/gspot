export const PROSE_COMMENT_CASES = [
    ['mts', '//', 'const text = "delve";'],
    ['mjs', '//', 'const text = "delve";'],
    ['', '#', 'text = "delve"'],
] as const;

export const MARKDOWN_COMMENT_CASES = [
    ['ts', '//', 'const text = "powerful";'],
    ['mts', '//', 'const text = "powerful";'],
    ['py', '#', 'text = "powerful"'],
] as const;

export const CONCRETE_RULE = `extends: existence
message: "Use inspect."
level: error
tokens: [delve]
`;

export const PROSE_CASES = [
    {
        check: 'prose/vale',
        files: {
            'docs/selling.md': `# A Page

This powerful cache makes the application much faster.
`,
        },
        expected: { file: 'docs/selling.md', rule: 'gspot.marketing', line: 3, column: 6 },
        corrected: {
            files: {
                'docs/selling.md': `# A Page

This cache returns stored records.
`,
            },
        },
    },
] as const;
