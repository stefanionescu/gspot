import { TOML_STRINGS } from '#cli/config/parsers/toml.ts';
import type { GrammarName } from '#cli/types/parsers/source.ts';

/** The comment syntax of each source extension, which the suppression check reads. */
export const COMMENT_STYLE_BY_EXTENSION: Record<string, 'slash' | 'hash' | 'dash' | 'html'> = {
    '.ts': 'slash',
    '.mts': 'slash',
    '.cts': 'slash',
    '.tsx': 'slash',
    '.js': 'slash',
    '.mjs': 'slash',
    '.cjs': 'slash',
    '.jsx': 'slash',
    '.swift': 'slash',
    '.css': 'slash',
    '.scss': 'slash',
    '.py': 'hash',
    '.sh': 'hash',
    '.bash': 'hash',
    '.zsh': 'hash',
    '.toml': 'hash',
    '.yml': 'hash',
    '.yaml': 'hash',
    '.sql': 'dash',
    '.pgsql': 'dash',
    '.psql': 'dash',
    '.md': 'html',
    '.html': 'html',
    '.htm': 'html',
};

export const COMMENT_OPENERS: Record<string, string[]> = {
    slash: ['//', '/*'],
    hash: ['#'],
    dash: ['--'],
    html: ['<!--'],
};

export const COMMENT_GRAMMARS = new Map<string, GrammarName>([
    ['.py', 'python'],
    ['.sh', 'bash'],
    ['.bash', 'bash'],
    ['.zsh', 'bash'],
    ['.swift', 'swift'],
    ['.html', 'html'],
    ['.htm', 'html'],
    ['.md', 'html'],
    ['.css', 'css'],
]);

// The pieces of a TOML file: a string, a comment to the end of the line, or a run of anything else.
export const TOML_TOKENS = new RegExp(String.raw`${TOML_STRINGS.source}|#[^\n]*|[^"'#]+|["']`, 'gu');
