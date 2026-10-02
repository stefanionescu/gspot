// The literal values checks/language/markdown reads: names, patterns, limits, and tables.

export const STRUCTURED_PARSERS = new Set(['json', 'toml', 'yaml']);
export const TREE_PARSERS = new Set(['typescript', 'javascript', 'python']);
export const ELLIPSIS_LINE = /^[\s#/]*\.\.\.\s*$/u;
export const ELLIPSIS_ARGUMENTS = '(...)';
export const ANGLE_PLACEHOLDER = /<[A-Z][A-Z0-9_-]*>/gu;
export const FENCE_PARSERS: Record<string, 'json' | 'toml' | 'yaml' | 'bash' | 'typescript' | 'javascript' | 'python'> =
    {
        json: 'json',
        jsonc: 'json',
        toml: 'toml',
        yaml: 'yaml',
        yml: 'yaml',
        bash: 'bash',
        sh: 'bash',
        shell: 'bash',
        ts: 'typescript',
        typescript: 'typescript',
        tsx: 'typescript',
        js: 'javascript',
        javascript: 'javascript',
        mjs: 'javascript',
        cjs: 'javascript',
        python: 'python',
        py: 'python',
    };
