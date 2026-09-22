// How the prose engine parses source files and Vale output.

/** File extension to how Vale reads it: by path with its own grammar, or through stdin under a grammar with the same comment marker. */
export const PROSE_GRAMMARS: Record<string, { mode: 'path' | 'stdin'; extension: string }> = {
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
    '.sh': { mode: 'stdin', extension: '.rb' },
    '.bash': { mode: 'stdin', extension: '.rb' },
    '.zsh': { mode: 'stdin', extension: '.rb' },
    '.py': { mode: 'stdin', extension: '.rb' },
    '.sql': { mode: 'stdin', extension: '.lua' },
    '.pgsql': { mode: 'stdin', extension: '.lua' },
    '.psql': { mode: 'stdin', extension: '.lua' },
};

/** A file with no extension and a shell shebang reads as shell. */
export const SCRIPT_TAG = 'shell';

/** What Vale never reads: URLs, tool directives and doc tags. Code spans and fences are the Markdown parser's job; a backtick pattern here swallowed whole fenced blocks. */
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

/** One Vale alert on the line output: file, line, column, check, message. */
export const VALE_LINE = /^(?<file>.+?):(?<line>\d+):(?<column>\d+):(?<check>[^:]+):(?<message>.*)$/u;

/** The name Vale gives stdin, followed by the grammar extension. */
export const VALE_STDIN = 'stdin';

/** The style directory under .gspot and the style Vale reads from it. */
export const STYLES_DIRECTORY = '.gspot/vale/styles';
export const GSPOT_STYLE = 'gspot';

/** The three length rules the docs limits set, by rule file stem and the limits key. */
export const LENGTH_RULES: Record<string, string> = {
    'sentence-length': 'docs.sentence_words',
    'step-length': 'docs.list_item_words',
    'paragraph-length': 'docs.paragraph_sentences',
};

/** The two things a source file must not say to Vale: a directive in Markdown, a block comment in SQL. */
export const VALE_DIRECTIVE = /<!--\s*vale\b/u;
export const CODE_SPAN = /`[^`]*`/gu;
export const SQL_BLOCK_COMMENT = '/*';
