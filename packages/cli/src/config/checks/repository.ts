// The literal values the checks of repository, dependencies, checks read: names, patterns, limits, and tables.
import type { DriftEntry } from '#cli/types/lifecycle/lifecycle.ts';

export const KILOBYTE = 1024;
export const POLICY_FILE = 'gspot.toml';
export const LANGUAGE_BY_EXTENSION: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.mts': 'typescript',
    '.cts': 'typescript',
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
};
export const CONFIG_STATEMENTS = new Set([
    'import_statement',
    'export_statement',
    'lexical_declaration',
    'type_alias_declaration',
    'comment',
    'empty_statement',
]);
export const CONFIG_LOGIC_NODES = new Set([
    'function_declaration',
    'generator_function_declaration',
    'function_expression',
    'arrow_function',
    'class_declaration',
    'if_statement',
    'for_statement',
    'for_in_statement',
    'while_statement',
    'do_statement',
    'switch_statement',
    'try_statement',
    'await_expression',
    'ternary_expression',
]);
export const CONFIG_CALL_ALLOWED = new Set(['Set', 'Map', 'RegExp']);
export const CONFIG_IMPORT_PREFIXES = ['#config/'];
export const MESSAGES: Record<DriftEntry['kind'], string> = {
    changed: 'This generated file differs from what gspot.toml renders.',
    missing: 'This generated file is missing.',
    stray: 'This file carries the gspot header but nothing in the selection renders it.',
    conflict: 'This generated file holds merge conflict markers, so no tool can read it.',
};
export const CONFLICT_HELP = 'Run gspot apply to write the file again, then gspot install to install what it records.';
export const MOVE_HELP =
    'Change policy in gspot.toml, then run gspot apply. Edited outputs are preserved; move them aside to regenerate.';
export const STRAY_HELP = 'Delete the file, or add the configuration that renders it.';
export const DRIFT_HELP: Record<DriftEntry['kind'], string> = {
    changed: MOVE_HELP,
    missing: MOVE_HELP,
    stray: STRAY_HELP,
    conflict: CONFLICT_HELP,
};
export const GSPOT_SUPPRESSION = {
    marker: '^(?://|#|--|<!--) ?gspot-ignore +[a-z0-9-]+/[a-z0-9-]+',
    reason: String.raw` -- (?<reason>\S.*)`,
};

export const BUNFIG = 'bunfig.toml';
export const DEFAULT_AGE_DAYS = 7;
export const NPM_MANIFEST = 'package.json';
export const DEPENDENCY_TABLES = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
export const EXACT_VERSION = /^\d+\.\d+\.\d+$|^\d+\.\d+\.\d+[-+][\w.+-]+$/u;
export const NON_REGISTRY_VERSION = /^(?:workspace:|file:|link:|git\+|github:|https?:|catalog:|npm:)/u;
export const LOCKFILE_URL = /\b(?:https?|git\+https?|git\+ssh|git):\/\/[^\s"',)\]]+/gu;
export const STALE_LOCK_DIAGNOSTICS: Record<string, RegExp> = {
    bun: /lockfile had changes, but lockfile is frozen/u,
    npm: /can only install packages when your package\.json and package-lock\.json or npm-shrinkwrap\.json are in sync/u,
    pnpm: /ERR_PNPM_(?:OUTDATED_LOCKFILE|FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE)/u,
    uv: /lockfile[\s\S]*needs to be updated/u,
    yarn: /Your lockfile needs to be updated|YN0028|lockfile would have been modified/u,
};
export const FROZEN_INSTALLS: Record<string, string[]> = {
    'bun.lock': ['bun', 'install', '--frozen-lockfile', '--dry-run'],
    'package-lock.json': ['npm', 'ci', '--dry-run', '--ignore-scripts'],
    'pnpm-lock.yaml': ['pnpm', 'install', '--frozen-lockfile', '--lockfile-only'],
    'yarn.lock': ['yarn', 'install', '--frozen-lockfile', '--ignore-scripts', '--non-interactive'],
    'uv.lock': ['uv', 'lock', '--check'],
};

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
export const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src', 'action', 'formaction', 'data', 'background']);
export const DOCUMENT_URL_ATTRIBUTES: Record<string, string[]> = {
    a: ['href', 'xlink:href'],
    area: ['href'],
    iframe: ['src'],
    frame: ['src'],
    object: ['data'],
    embed: ['src'],
};
export const ACTIVE_DOCUMENT_TYPES = new Set(['text/html', 'application/xhtml+xml', 'image/svg+xml']);
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
