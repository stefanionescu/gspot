// What the docs checks refuse and require: headings that index instead of explain, the README shape, the tokens that look like paths.

/** Headings that promise an inventory instead of an explanation. */
export const BANNED_HEADINGS = [
    'table of contents',
    'project structure',
    'repository layout',
    'directory structure',
    'file map',
    'codebase map',
];

/** A README section whose heading contains one of these words tells the reader how to start. */
export const START_SECTION_WORDS = ['install', 'setup', 'start', 'requirements'];

/** How many H2 headings a README may have before it needs a Contents list. */
export const CONTENTS_THRESHOLD = 6;

/** The heading of the list that indexes a long README. */
export const CONTENTS_HEADING = 'contents';

/** The characters a path token is made of. */
export const PATH_CHARS = /^[\w./-]+$/u;

/** What separates tokens in a line of prose. */
export const TOKEN_SEPARATORS = /[\s`'"()[\],;:!?<>|*]+/u;

/** A `mise run`, `bun run` or `npm run` invocation and the task it names. */
export const RUN_TOKEN = /\b(?<runner>mise|bun|npm|pnpm) run (?<task>[\w:.-]+)/gu;

/** Fence languages whose content is prose or placeholders, not paths. */
export const FREE_TEXT_FENCES = ['text', 'plaintext', 'console', 'diff'];

/** A token whose last segment ends in a file extension. */
export const FILE_EXTENSION = /\.[a-z0-9]+$/iu;

/** Path tokens that never name a tracked file. */
export const PATH_TOKEN_SKIPS = [/^https?:/u, /^[a-z]+:\/\//u, /^\.\.?\/?$/u, /^\/dev\//u, /^\d+\/\d+$/u, /^\//u];

/** What an example leaves out: a line of three dots, or an <UPPER_CASE> value the reader supplies. Both are replaced before parsing. */
export const ELLIPSIS_LINE = /^[\s#/]*\.\.\.\s*$/u;
export const ELLIPSIS_ARGUMENTS = '(...)';
export const ANGLE_PLACEHOLDER = /<[A-Z][A-Z0-9_-]*>/gu;

/** Fence languages the fences check parses, and which parser reads each. */
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
