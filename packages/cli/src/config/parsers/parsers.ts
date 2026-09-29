// The literal values parsers read: names, patterns, limits, and tables.
import type { GrammarName } from '#cli/types/parsers/parsers.ts';

// The strings of a TOML file, read whole: triple-quoted ones span lines, and a backslash escapes inside a
// basic string.
const TOML_STRINGS = /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'[^'\n]*'/u;
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
]);
// The pieces of a TOML file: a string, a comment to the end of the line, or a run of anything else.
export const TOML_TOKENS = new RegExp(String.raw`${TOML_STRINGS.source}|#[^\n]*|[^"'#]+|["']`, 'gu');
