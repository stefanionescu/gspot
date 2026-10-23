import { PROSE_GRAMMARS } from '#cli/config/checks/general/prose.ts';
import { TOKEN_IGNORES } from '#cli/config/generation/configurations/general/prose.ts';

/** Each JavaScript and TypeScript file kind with its comment marker and a sentence that Vale reports. */
export const PROSE_COMMENT_CASES = [
    ['mts', '//', 'const text = "delve";'],
    ['cts', '//', 'const text = "delve";'],
    ['mjs', '//', 'const text = "delve";'],
    ['cjs', '//', 'const text = "delve";'],
    ['', '#', 'text = "delve"'],
] as const;

/** Each source file kind with its comment marker and a line of code whose string holds no prose. */
export const MARKDOWN_COMMENT_CASES = [
    ['ts', '//', 'const text = "delve";'],
    ['mts', '//', 'const text = "delve";'],
    ['py', '#', 'text = "delve"'],
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

/** A vale.ini that maps every source format that gspot reads as prose, with the token ignores that gspot writes. */
export const FORMATS_VALE_INI = [
    'StylesPath = styles',
    '[formats]',
    ...Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]) =>
        'format' in grammar ? [`${extension.slice(1)} = ${grammar.format}`] : [],
    ),
    '[*]',
    'BasedOnStyles = Example',
    `TokenIgnores = ${TOKEN_IGNORES.join(', ')}`,
    '',
].join('\n');
