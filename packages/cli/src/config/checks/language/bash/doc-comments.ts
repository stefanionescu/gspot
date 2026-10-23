export const SHELLCHECK_TOOL_COMMENT = /^#\s*shellcheck\b/u;

export const LEADING_UNDERSCORES = /^_+/u;

export const WORD = /[A-Za-z0-9]+/gu;

export const VAGUE_WORDS: ReadonlySet<string> = new Set([
    'a',
    'an',
    'and',
    'do',
    'does',
    'execute',
    'executes',
    'handle',
    'handles',
    'perform',
    'performs',
    'run',
    'runs',
    'the',
]);

export const BASH_DOC_SECTIONS = ['# Globals:', '# Arguments:', '# Outputs:', '# Returns:'] as const;
