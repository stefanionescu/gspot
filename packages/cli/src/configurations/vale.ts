/** File extension to how Vale reads it: by path with its own grammar, or through stdin under a grammar with the same comment marker. */
// Vale reads Markdown and the comments of the languages it knows by path. A language it does not know borrows the
// format of one with the same comment style through the [formats] section, so it is read by path too (K-176).
export const PROSE_GRAMMARS: Record<string, { mode: 'path' | 'stdin'; extension: string; format?: string }> = {
    '.md': { mode: 'path', extension: '.md' },
    '.mdx': { mode: 'path', extension: '.md' },
    '.ts': { mode: 'path', extension: '.ts' },
    '.tsx': { mode: 'path', extension: '.ts' },
    '.mts': { mode: 'path', extension: '.ts' },
    '.cts': { mode: 'path', extension: '.ts' },
    '.js': { mode: 'path', extension: '.js' },
    '.mjs': { mode: 'path', extension: '.js' },
    '.cjs': { mode: 'path', extension: '.js' },
    '.jsx': { mode: 'path', extension: '.js' },
    '.swift': { mode: 'path', extension: '.swift' },
    '.py': { mode: 'path', extension: '.py' },
    '.css': { mode: 'path', extension: '.css' },
    '.sh': { mode: 'path', extension: '.sh', format: 'py' },
    '.bash': { mode: 'path', extension: '.bash', format: 'py' },
    '.zsh': { mode: 'path', extension: '.zsh', format: 'py' },
    '.sql': { mode: 'path', extension: '.sql', format: 'lua' },
    '.pgsql': { mode: 'path', extension: '.pgsql', format: 'lua' },
    '.psql': { mode: 'path', extension: '.psql', format: 'lua' },
};

/** The [formats] lines of vale.ini: each borrowed extension, without its dot, and the format Vale reads it as. */
export const PROSE_FORMATS: [string, string][] = Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]) =>
    grammar.format === undefined ? [] : [[extension.slice(1), grammar.format]],
);

/** A script with no extension reads through stdin as Python, whose comments start the same way. */
export const SCRIPT_GRAMMAR = { mode: 'stdin', extension: '.py' } as const;

/** A file with no extension and a shell shebang reads as shell. */
export const SCRIPT_TAG = 'shell';

/** What Vale never reads: URLs, tool directives and doc tags. The Markdown parser handles code spans and fences. */
export const TOKEN_IGNORES = [
    String.raw`(https?://[^\s)]+)`,
    String.raw`(eslint-disable[^\n]*)`,
    String.raw`(@ts-expect-error[^\n]*)`,
    String.raw`(@ts-ignore[^\n]*)`,
    String.raw`(swiftlint:[^\n]*)`,
    String.raw`(shellcheck [^\n]*)`,
    String.raw`(nosemgrep[^\n]*)`,
    String.raw`(MARK: -[^\n]*)`,
    String.raw`(@(?:param|returns|throws|template|typedef|type|see|example|deprecated)\b[^\n]*)`,
];

/** Front matter is not prose. */
export const BLOCK_IGNORES = [String.raw`(?s)^---\n.*?\n---\n`];

/** The name Vale gives stdin, followed by the grammar extension. */
export const VALE_STDIN = 'stdin';

/** The style directory under .gspot and the style Vale reads from it. */
export const STYLES_DIRECTORY = '.gspot/config/vale/styles';
export const GSPOT_STYLE = 'gspot';

/** The three length rules the docs limits set, by rule file stem and the limits key. */
export const LENGTH_RULES: Record<string, string> = {
    'sentence-length': 'docs.sentence_words',
    'step-length': 'docs.list_item_words',
    'paragraph-length': 'docs.paragraph_sentences',
};

export const VALE_CONFIG = '.gspot/config/vale.ini';
