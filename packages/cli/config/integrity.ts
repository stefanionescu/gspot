// What the integrity checks refuse: logic in configuration modules, suppressions without a reason, files above the size limit. Literals only.
import type { SuppressionForm } from '#types/integrity.ts';

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

/** The inline suppression forms per comment style: the directive, how its reason is written, and the rule name. Only the comment part of a line is searched. */
export const SUPPRESSION_FORMS: Record<string, SuppressionForm[]> = {
    slash: [
        { form: 'eslint-disable', marker: /\beslint-disable(?:-next-line|-line)?\b/u, reason: / -- \S/u },
        { form: 'ts-expect-error', marker: /@ts-expect-error\b/u, reason: /@ts-expect-error: \S/u },
        { form: 'ts-ignore', marker: /@ts-ignore\b/u, reason: /@ts-ignore: \S/u },
        { form: 'swiftlint-disable', marker: /swiftlint:disable\b/u, reason: / - \S/u },
        { form: 'lint-justify', marker: /\blint:justify\b/u, reason: /reason: \S/u },
        { form: 'gspot-ignore', marker: /gspot-ignore +[a-z0-9-]+\/[a-z0-9-]+/u, reason: / -- \S/u },
        { form: 'nosemgrep', marker: /\bnosemgrep\b/u, reason: /$^/u, isForbidden: true },
    ],
    hash: [
        {
            form: 'shellcheck-disable',
            marker: /shellcheck disable=/u,
            reason: /(?:# ?reason:|lint:justify reason:) \S/u,
        },
        { form: 'noqa', marker: /# ?noqa\b/u, reason: /#[^#]*# ?\S/u },
        { form: 'nosec', marker: /# ?nosec\b/u, reason: /#[^#]*# ?\S/u },
        { form: 'type-ignore', marker: /# ?type: ?ignore\b/u, reason: /#[^#]*# ?\S/u },
        { form: 'pyright-ignore', marker: /# ?pyright: ?ignore\b/u, reason: /#[^#]*# ?\S/u },
        { form: 'no-cover', marker: /# ?pragma: ?no cover\b/u, reason: /#[^#]*# ?\S/u },
        { form: 'gspot-ignore', marker: /gspot-ignore +[a-z0-9-]+\/[a-z0-9-]+/u, reason: / -- \S/u },
        { form: 'nosemgrep', marker: /\bnosemgrep\b/u, reason: /$^/u, isForbidden: true },
    ],
};

/** The tasks each task runner must hold. */
export const REQUIRED_TASKS: Record<string, string[]> = {
    mise: ['gspot:check', 'gspot:fix', 'gspot:apply', 'gspot:doctor', 'gspot:setup'],
    npm: ['check', 'check:fix', 'apply', 'prepare'],
    bun: ['check', 'check:fix', 'apply', 'prepare'],
    pnpm: ['check', 'check:fix', 'apply', 'prepare'],
};

/** The hook files gspot installs. */
export const HOOK_FILES = ['pre-commit', 'pre-push', 'commit-msg'];

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

/** The image of one Compose service; every pattern below reads a trimmed line with single spaces. */
export const COMPOSE_IMAGE = /^image: ["']?(?<found>[^ "'#]+)/u;

/** The certificate a server block opens. */
export const NGINX_CERTIFICATE = /^ssl_(?:trusted_)?certificate (?<found>[^; ]+)/u;

/** The key a server block opens. */
export const NGINX_KEY = /^ssl_certificate_key (?<found>[^; ]+)/u;

/** A host nginx resolves when it reads the file: a proxy target or an upstream server. */
export const NGINX_UPSTREAM = /^(?:proxy_pass https?:\/\/|server )(?<found>[A-Za-z][\w.-]*)/u;
