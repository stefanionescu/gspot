// What the integrity checks refuse: logic in configuration modules, suppressions without a reason, files above the size limit. Literals only.

/** Top-level statement types a configuration module may hold. */
export const CONFIG_STATEMENTS = [
    'import_statement',
    'export_statement',
    'lexical_declaration',
    'type_alias_declaration',
    'comment',
    'empty_statement',
];

/** Node types that are logic, anywhere in a configuration module. */
export const CONFIG_LOGIC_NODES = [
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
];

/** A call is logic unless it is a tagged template (`String.raw` on a pattern) or a constructor of a plain collection. */
export const CONFIG_CALL_ALLOWED = ['Set', 'Map', 'RegExp'];

/** Modules a configuration module may import values from: none but its own roots; type imports are free. */
export const CONFIG_IMPORT_PREFIXES = ['#config/'];

/** The default ceiling on a tracked file, in kilobytes, when the limit is unset. */
export const FILE_SIZE_KB_DEFAULT = 1024;

/** The hook files gspot installs. */
export const HOOK_FILES = ['pre-commit', 'pre-push', 'commit-msg'] as const;

/** Folders a package manager or a build fills; git tracks nothing inside one. */
export const DEPENDENCY_FOLDERS = [
    'node_modules',
    'bower_components',
    '.venv',
    'venv',
    'Pods',
    'DerivedData',
    '.build',
];

/** The tables of a package.json that hold versions. */
export const DEPENDENCY_TABLES = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;

/** One exact version: digits and dots, with an optional prerelease or build tag. */
export const EXACT_VERSION = /^\d+\.\d+\.\d+$|^\d+\.\d+\.\d+[-+][\w.+-]+$/u;

/** A version that names no registry range: a workspace, a file, a link, a git source or a catalog. */
export const NON_REGISTRY_VERSION = /^(?:workspace:|file:|link:|git\+|github:|https?:|catalog:|npm:)/u;

/** The lockfile names, by the package manager that writes each. */
export const LOCKFILES: Record<string, string> = {
    'bun.lock': 'bun',
    'bun.lockb': 'bun',
    'package-lock.json': 'npm',
    'pnpm-lock.yaml': 'pnpm',
    'yarn.lock': 'yarn',
};

/** The command that installs from a lockfile and fails when the lockfile is out of date. */
export const FROZEN_INSTALLS: Record<string, string[]> = {
    'bun.lock': ['bun', 'install', '--frozen-lockfile', '--dry-run'],
    'package-lock.json': ['npm', 'ci', '--dry-run', '--ignore-scripts'],
    'pnpm-lock.yaml': ['pnpm', 'install', '--frozen-lockfile', '--lockfile-only'],
    'yarn.lock': ['yarn', 'install', '--frozen-lockfile', '--ignore-scripts', '--non-interactive'],
    'uv.lock': ['uv', 'lock', '--check'],
};

/** Seconds in one day, for the release age the package manager counts in seconds. */
export const SECONDS_PER_DAY = 86_400;

/** A URL inside a lockfile, up to the quote, the space or the bracket that ends it. */
export const LOCKFILE_URL = /\b(?:https?|git\+https?|git\+ssh|git):\/\/[^\s"',)\]]+/gu;

/** What every Docker ignore file keeps out of the build. */
export const DOCKERIGNORE_ENTRIES = ['.git', 'node_modules', '.env'];

/** The Compose file patterns. */
export const COMPOSE_FILES = [
    '**/docker-compose*.yml',
    '**/docker-compose*.yaml',
    '**/compose*.yml',
    '**/compose*.yaml',
];
