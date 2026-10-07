import type { PackageInstaller } from '#cli/types/parsers/packages.ts';

export const HTTP_URL = /^https?:\/\//u;

export const INTEGRITY = /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/u;

export const CREDENTIAL_KEY = /(?:_authToken|_auth|_password|key)$/iu;

export const ENCODED_CREDENTIAL_KEY = /(?:_auth|_password)$/u;

export const CONNECTION_URL_KEY = /registry$|(?:^|_)(?:https-)?proxy$/iu;

export const NPM_SETTING_PREFIX = 'npm_config_';

export const PACKAGE_SETTING_VARIABLE_PREFIX = 'GSPOT_PACKAGE_SETTING_';

export const YARN_SETTING_VARIABLE_PREFIX = 'GSPOT_YARN_SETTING_';

// A package that fetches its binary at install time can fail for a reason the package manager does not name.
export const GITHUB_DOWNLOAD_URL =
    /https?:\/\/(?:api\.github\.com\/|github\.com\/[^/\s?#]+\/[^/\s?#]+\/releases(?:\/|[?\s]|$))/iu;

export const GITHUB_REFUSAL = /\b(?:HTTP 403|status 403|403 Forbidden|rate limit exceeded)\b/iu;

export const CONNECTION_KEYS = new Set([
    'registry',
    'proxy',
    'https-proxy',
    'noproxy',
    'strict-ssl',
    'ca',
    'cafile',
    'cert',
    'key',
    'always-auth',
]);

export const YARN_CONNECTION_KEYS = new Set([
    'npmRegistryServer',
    'npmRegistries',
    'npmScopes',
    'npmAuthToken',
    'npmAuthIdent',
    'npmAlwaysAuth',
    'httpProxy',
    'httpsProxy',
    'enableStrictSsl',
    'httpsCaFilePath',
    'httpsCertFilePath',
    'httpsKeyFilePath',
    'networkSettings',
    'unsafeHttpWhitelist',
]);

export const YARN_ENVIRONMENT_SETTINGS = [
    { pattern: /^npm_config_@([^:]+):registry$/u, setting: 'npmScopes', field: 'npmRegistryServer', defaults: {} },
    {
        pattern: /^npm_config_(\/\/[^\s]+):_authToken$/u,
        setting: 'npmRegistries',
        field: 'npmAuthToken',
        defaults: { npmAlwaysAuth: true },
    },
];

/** Native lock resolution runs without committing a tool project installation. */
export const LOCK_ARGUMENTS: Record<Exclude<PackageInstaller['name'], 'yarn'>, readonly string[]> = {
    npm: ['npm', 'install', '--package-lock-only', '--no-audit', '--no-fund', '--omit-lockfile-registry-resolved'],
    bun: ['bun', 'install', '--lockfile-only', '--linker', 'hoisted'],
    pnpm: ['pnpm', 'install', '--lockfile-only', '--ignore-workspace', '--node-linker=hoisted'],
};

/** Native installation refuses any change to the recorded lock. */
export const INSTALL_ARGUMENTS: Record<Exclude<PackageInstaller['name'], 'yarn'>, readonly string[]> = {
    npm: ['npm', 'ci', '--no-audit', '--no-fund', '--omit-lockfile-registry-resolved'],
    bun: ['bun', 'install', '--frozen-lockfile', '--linker', 'hoisted'],
    pnpm: ['pnpm', 'install', '--frozen-lockfile', '--ignore-workspace', '--node-linker=hoisted'],
};

/** Yarn Classic and Berry declare different native lock operations. */
export const YARN_ARGUMENTS = {
    classic: { lock: ['yarn', 'install'], install: ['yarn', 'install', '--frozen-lockfile'] },
    berry: { lock: ['yarn', 'install', '--mode=update-lockfile'], install: ['yarn', 'install', '--immutable'] },
} as const;

/** Private Yarn projects use a local node_modules tree with the shared package cache. */
export const YARN_PRIVATE_SETTINGS = 'nodeLinker: node-modules\nenableGlobalCache: true\n';
