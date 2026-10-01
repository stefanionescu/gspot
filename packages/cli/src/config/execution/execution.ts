// The literal values execution reads: names, patterns, limits, and tables.

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
export const FIX_PASSES = 3;
export const FIX_DIFF_CONTEXT = 3;
export const RAN_STATUSES = new Set(['ok', 'fail']);
export const FILES_PLACEHOLDER = '{files}';
export const FAILED_STATUSES = new Set(['fail', 'missing', 'error']);
export const DOCKER = { name: 'docker', provider: 'host' as const, installers: {} };
/** The comment syntax of each source extension, which the suppression check reads. */
export const COMMENT_STYLE_BY_EXTENSION: Record<string, 'slash' | 'hash' | 'dash' | 'html'> = {
    '.ts': 'slash',
    '.mts': 'slash',
    '.cts': 'slash',
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
/** Native structured reporters reserve these nonzero exit codes for findings. */
export const FINDING_EXIT_CODES = new Map<string | undefined, number[]>([
    ['typos-json', [TYPOS_FINDINGS]],
    ['markdownlint-json', [1]],
]);

export const SCRATCH_EXTRAS = ['gspot.toml', 'package.json', 'tsconfig.json', 'pyproject.toml'];
export const SCRATCH_DIRECTORIES = ['node_modules', '.venv'];
/** A project manifest marks a folder whose installed dependencies a scratch copy carries. */
export const PROJECT_MANIFESTS = ['package.json', 'pyproject.toml'];
export const PLATFORM_NAMES: Record<string, string> = { darwin: 'macos', linux: 'linux', win32: 'windows' };
/** The words a platform name is written with in a sentence. */
export const PLATFORM_LABELS: Record<string, string> = { macos: 'macOS', linux: 'Linux', windows: 'Windows' };
export const HISTORY_ANALYSES = new Set(['commit-messages', 'gitleaks-history', 'verified-secrets']);
