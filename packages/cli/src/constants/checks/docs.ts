// The literal values checks/docs reads: names, patterns, limits, and tables.

export const JSCPD_TOOL = 'jscpd';
export const TRAILING_PUNCTUATION = '.,;:';
export const PATH_CHARS = /^[\w./-]+$/u;
export const TOKEN_SEPARATORS = /[\s`'"()[\],;:!?<>|*]+/u;
export const RUN_TOKEN = /\b(?<runner>mise|bun|npm|pnpm|yarn) run (?<task>[\w:.-]+)/gu;
export const FREE_TEXT_FENCES = new Set(['text', 'plaintext', 'console', 'diff']);
export const FILE_EXTENSION = /\.[a-z0-9]+$/iu;
export const PATH_TOKEN_SKIPS = [/^https?:/u, /^[a-z]+:\/\//u, /^\.\.?\/?$/u, /^\/dev\//u, /^\d+\/\d+$/u, /^\//u];
export const DEFAULT_CEILING = 4;
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
export const BANNED_HEADINGS = [
    'table of contents',
    'project structure',
    'repository layout',
    'directory structure',
    'file map',
    'codebase map',
];
export const START_SECTION_WORDS = ['install', 'setup', 'start', 'requirements'];
export const CONTENTS_THRESHOLD = 6;
export const CONTENTS_HEADING = 'contents';
export const LICENSE_NAMES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt'];
