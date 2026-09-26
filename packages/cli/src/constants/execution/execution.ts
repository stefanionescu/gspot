// The literal values execution reads: names, patterns, limits, and tables.
import type { FixOrder } from '#cli/types/configurations.ts';

export const WINDOWS_COMMAND_LIMIT = 7000;
export const UNIX_COMMAND_LIMIT = 100_000;
export const WINDOWS_ESCAPE_EXPANSION = 5;
export const WINDOWS_ARGUMENT_OVERHEAD = 9;
export const COMMAND_CONFIG_PLACEHOLDER = /\{config:(?<name>[a-z0-9-]+)\}/gu;
export const POINTER_PLACEHOLDER = /\{pointer:(?<name>[^}]+)\}/gu;
export const WORKSPACE_PREFIX = '{workspace:';
export const SETTING_PLACEHOLDER = /\{setting:(?<name>[a-z\d_.-]+)\}/gu;
export const EXISTING_PLACEHOLDER = /^\{existing:(?<flag>[^:]+):(?<path>[^}]+)\}$/u;
export const EACH_PLACEHOLDER = /^\{each:(?<flag>[^:]+):(?<setting>[a-z0-9_.-]+)\}$/u;
export const FIX_ORDER: FixOrder[] = ['codemod', 'imports', 'manifest', 'format'];
export const FIX_DIFF_CONTEXT = 3;
export const RAN_STATUSES = new Set(['ok', 'cache', 'fail']);
export const FILES_PLACEHOLDER = '{files}';
export const CORE_KINDS = new Set(['format', 'syntax', 'style', 'types']);
export const CACHE_FORMAT = 5;
// Thirty days in milliseconds.
export const RETENTION_MS = 2_592_000_000;
export const CACHE_ENTRY = /^\.gspot\/cache\/[a-f0-9]{64}\.json$/u;
export const FAILED_STATUSES = new Set(['fail', 'missing', 'error']);
export const DOCKER = { name: 'docker', provider: 'host' as const, windows: true, installers: {} };
// reason is what follows `--` in the rest of the comment.
export const INLINE_IGNORE: Record<string, RegExp> = {
    slash: /\/\/ ?gspot-ignore +([a-z0-9/-]+)/u,
    hash: /# ?gspot-ignore +([a-z0-9/-]+)/u,
    dash: /-- ?gspot-ignore +([a-z0-9/-]+)/u,
    html: /<!-- ?gspot-ignore +([a-z0-9/-]+)/u,
};
export const REASON_INTRODUCER = '--';
export const HTML_COMMENT_CLOSE = '-->';
export const COMMENT_STYLE_BY_EXTENSION: Record<string, keyof typeof INLINE_IGNORE> = {
    '.ts': 'slash',
    '.tsx': 'slash',
    '.js': 'slash',
    '.mjs': 'slash',
    '.cjs': 'slash',
    '.jsx': 'slash',
    '.swift': 'slash',
    '.css': 'slash',
    '.scss': 'slash',
    '.py': 'hash',
    '.sh': 'hash',
    '.bash': 'hash',
    '.zsh': 'hash',
    '.toml': 'hash',
    '.yml': 'hash',
    '.yaml': 'hash',
    '.rb': 'hash',
    '.sql': 'dash',
    '.pgsql': 'dash',
    '.psql': 'dash',
    '.md': 'html',
    '.html': 'html',
    '.htm': 'html',
};
export const COMMENT_OPENERS: Record<string, string[]> = {
    slash: ['//', '/*'],
    hash: ['#'],
    dash: ['--'],
    html: ['<!--'],
};
export const POLICY_CHECK = 'integrity/policy';
export const UNABLE_EXIT = 2;
// These formats have no file in their findings by design, so a finding with no file says nothing about the tool.
export const FILELESS_FORMATS = new Set(['lines', 'none']);
export const TAIL_LINES = 20;
export const TRUFFLEHOG_FINDINGS = 183;
export const TYPOS_FINDINGS = 2;
export const SCRATCH_EXTRAS = ['gspot.toml', 'package.json', 'tsconfig.json', 'pyproject.toml'];
export const SCRATCH_DIRECTORIES = ['node_modules', '.venv'];
export const PLATFORM_NAMES: Record<string, string> = { darwin: 'macos', linux: 'linux', win32: 'windows' };
export const HISTORY_ANALYSES = new Set(['commit-messages', 'gitleaks-history', 'verified-secrets']);
