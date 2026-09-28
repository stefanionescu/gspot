// The literal values parsers read: names, patterns, limits, and tables.
import type { GrammarName } from '#cli/types/parsers/parsers.ts';

export const DECLARATION_FILE = /\.d\.[cm]?ts$/u;

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
    ['.rb', 'ruby'],
    ['.toml', 'toml'],
]);
