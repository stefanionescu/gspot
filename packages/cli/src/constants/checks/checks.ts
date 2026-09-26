// The literal values checks reads: names, patterns, limits, and tables.

export const HTTP_HEADER_LINE = /^[A-Za-z!][\w!#$%&'*+.^`|~-]*:\s*\S/u;
// The shipped limit on declared input parameters when the policy names none.
export const SHIPPED_PARAMETER_LIMIT = 7;
export const POSTGRES_DIALECTS = new Set(['postgres', 'ansi']);
export const BLOCK_COMMENT = '/*';
export const LINE_COMMENT = '--';
// A string, a quoted name, a line comment, or the start of a block comment, whichever comes first.
export const SQL_TOKENS = /'[^']*'|"[^"]*"|--[^\n]*|\/\*/gu;
export const OUTPUT_PARAMETERS = new Set(['FUNC_PARAM_OUT', 'FUNC_PARAM_TABLE']);
export const LICENSE_CHECKER_TOOL = 'license-checker-rseidelsohn';
// Expo Doctor prints each failed check on a line of its own, then the issues it found, then its advice.
export const FAILED_CHECK = /^✖ (?<description>.+)$/u;
export const MODULE_SUFFIX = /\.module\.css$/u;
export const CODE_SUFFIX = /\.(?:tsx?|jsx?|mjs)$/u;
// svelte-check writes each diagnostic on a line of its own: a timestamp, then the diagnostic as JSON.
export const DIAGNOSTIC_LINE = /^\d+ (?<diagnostic>\{.*\})$/u;
export const FAILURE_LINE = /^\d+ FAILURE (?<message>".*")$/u;
export const STATUS_CODES = new Set(['200', '301', '302', '303', '307', '308', '404', '410']);
export const COMPATIBILITY_DATE = /^\d{4}-\d{2}-\d{2}$/u;
export const TYPES_FILE = 'cloudflare-env.d.ts';
export const REDIRECT_PARTS = { least: 2, most: 3 };
export const ACTIONLINT_COMMAND = ['actionlint', '-no-color', '{files}'];
export const INERT_SCRIPT_TYPES = new Set(['application/ld+json', 'application/json', 'importmap', 'speculationrules']);
export const COPY_ATTRIBUTES = new Set(['alt', 'aria-label', 'aria-description', 'placeholder', 'title']);
// The marks that open and close a placeholder in the template languages a static site uses.
export const PLACEHOLDER_MARKS: [string, string][] = [
    ['{{', '}}'],
    ['{%', '%}'],
    ['<%', '%>'],
    ['${', '}'],
];
export const SHOWN_TEXT = 40;
export const LETTERS = /\p{L}{2,}/u;
export const ANSIBLE_PROJECT_FILE = 'ansible.cfg';
export const LINT_LINE = /^(?<file>[^:]+):(?<line>\d+):[\d:]* (?<rule>[^:]+): (?<text>.*)$/u;
export const TABLE = /export const (?<name>\w+) = \w*[tT]able\(/gu;
