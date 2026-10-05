import type { FenceParser } from '#cli/types/parsers/markdown.ts';

export const TRAILING_PUNCTUATION = '.,;:';

export const PATH_CHARS = /^[\w./-]+$/u;

export const TOKEN_SEPARATORS = /[\s`'"()[\],;:!?<>|]+/u;

export const FREE_TEXT_FENCES = new Set(['text', 'plaintext', 'console', 'diff']);

export const PATH_TOKEN_SKIPS = [/^\.\.?\/?$/u, /^\d+\/\d+$/u, /^\//u];

export const ELLIPSIS_LINE = /^[\s#/]*\.\.\.\s*$/u;

export const ELLIPSIS_ARGUMENTS = '(...)';

export const ANGLE_PLACEHOLDER = /<[A-Z][A-Z0-9_-]*>/gu;

export const FENCE_PARSERS: Record<string, FenceParser> = {
    json: 'json',
    jsonc: 'jsonc',
    toml: 'toml',
    yaml: 'yaml',
    yml: 'yaml',
    bash: 'bash',
    sh: 'bash',
    shell: 'bash',
    ts: 'typescript',
    typescript: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'javascript',
    javascript: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    python: 'python',
    py: 'python',
};

/** Bash reports one-based lines in its first syntax diagnostic. */
export const BASH_ERROR_LINE = /\bline (?<line>\d+):/u;
