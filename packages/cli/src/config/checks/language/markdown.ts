export const ELLIPSIS_LINE = /^[\s#/]*\.\.\.\s*$/u;

export const ELLIPSIS_ARGUMENTS = '(...)';

export const ANGLE_PLACEHOLDER = /<[A-Z][A-Z0-9_-]*>/gu;

export const FENCE_PARSERS = {
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
} as const;

export const JSON_FENCE_OPTIONS = { disallowComments: true, allowTrailingComma: false } as const;
export const OMITTED_BASH_LINE = ':';
export const EMPTY_ARGUMENTS = '()';
export const PLACEHOLDER_VALUE = 'PLACEHOLDER';

export const MARKDOWNLINT_PATH_PREFIX = ':';

export const CAMEL_CASE_BOUNDARY = /(?<first>[a-z])(?<next>[A-Z])/gu;
