// The literal values tools/packages reads: names, patterns, limits, and tables.

export const TOOL_PACKAGE_PROJECT = '.gspot/package.json';
export const YARN_SETTINGS = '.gspot/.yarnrc.yml';
export const CREDENTIAL_KEY = /(?:_authToken|_auth|_password|key)$/iu;
export const NPM_SETTING_PREFIX = 'npm_config_';
// A package that fetches its binary at install time can fail for a reason the package manager does not name.
export const GITHUB_REFUSAL = /api\.github\.com|github\.com\/.*\/releases|HTTP 403|rate limit/iu;
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
export const KEYS = new Set([
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
export const CONFLICT_MARKER = /^(?:<{7}|={7}|>{7})/mu;
export const HTTP_URL = /^https?:\/\//u;
export const INTEGRITY = /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/u;

/** The lock file each package manager writes. */
export const LOCKS = { npm: 'package-lock.json', bun: 'bun.lock', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock' } as const;
