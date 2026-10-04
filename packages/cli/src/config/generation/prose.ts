import type { ProseGrammar } from '#cli/types/generation/prose.ts';

export const STYLE_ASSETS = 'configurations/general/prose/styles/gspot/';

export const MAX_LINE = /^max: \d+$/mu;

export const LONGER_THAN = /longer than \d+/u;

/** The Vale input mode, source grammar, and comment format for each file extension. */
// Known source grammars parse Markdown inside comments. Module extensions without a native grammar use stdin
// with the corresponding language extension. Other comment-compatible formats are mapped through [formats].
export const PROSE_GRAMMARS: Record<string, ProseGrammar> = {
    '.md': { mode: 'path', extension: '.md' },
    '.mdx': { mode: 'path', extension: '.md' },
    '.ts': { mode: 'path', extension: '.ts', format: 'md' },
    '.tsx': { mode: 'path', extension: '.ts', format: 'md' },
    '.mts': { mode: 'stdin', extension: '.ts' },
    '.cts': { mode: 'stdin', extension: '.ts' },
    '.js': { mode: 'path', extension: '.js', format: 'md' },
    '.mjs': { mode: 'stdin', extension: '.js' },
    '.cjs': { mode: 'stdin', extension: '.js' },
    '.jsx': { mode: 'path', extension: '.js', format: 'md' },
    '.swift': { mode: 'path', extension: '.swift', format: 'md' },
    '.py': { mode: 'path', extension: '.py', format: 'md' },
    '.css': { mode: 'path', extension: '.css', format: 'md' },
    '.sh': { mode: 'path', extension: '.sh', format: 'py' },
    '.bash': { mode: 'path', extension: '.bash', format: 'py' },
    '.zsh': { mode: 'path', extension: '.zsh', format: 'py' },
    '.sql': { mode: 'path', extension: '.sql', format: 'lua' },
    '.pgsql': { mode: 'path', extension: '.pgsql', format: 'lua' },
    '.psql': { mode: 'path', extension: '.psql', format: 'lua' },
};

export const GSPOT_STYLE = 'gspot';

/** Maps the three documentation length rules to their limit keys. */
export const LENGTH_RULES: Record<string, string> = {
    'sentence-length': 'docs.sentence_words',
    'item-length': 'docs.list_item_words',
    'paragraph-length': 'docs.paragraph_sentences',
};
