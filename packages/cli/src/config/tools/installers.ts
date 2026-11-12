import { HOOKS_PATH_SETTING } from '#cli/config/repository/setup.ts';

export const CONFIG_FLAG = '--config';

export const CHECK_HOOKS = ['pre-commit', 'pre-push', 'commit-msg'] as const;

export const HOOK_CHECKS = {
    'pre-commit': { arguments: 'check --staged --only commit', stages: ['commit'] },
    'pre-push': { arguments: 'check --hook pre-push -- "$@"', stages: ['push'] },
    'commit-msg': { arguments: 'check --hook commit-msg -- "$1"', stages: ['message'] },
} as const satisfies Record<(typeof CHECK_HOOKS)[number], { arguments: string; stages: readonly string[] }>;

export const CONFIG_TOML_FORMAT = { inlineTableStart: Number.MAX_SAFE_INTEGER, bracketSpacing: false } as const;

export const GRAMMAR_TOOL_NOUN = 'grammar';

export const JSON_INDENT = 4;

export const INSTALL_OUTPUT_LIMIT = 4000;

export const URL_CREDENTIALS = /(https?:\/\/)[^\s/@]+@/giu;

export const LOCKFILE_URL_PASSWORD = /https?:\/\/[^\s"'/:]*:[^\s"'/]+@/iu;

export const REDACTED = '[redacted]';

export const EMPTY_OUTPUT_MESSAGE = 'The command printed no output.';

export const SET_HOOKS_PATH = ['git', 'config', HOOKS_PATH_SETTING] as const;

export const UNSET_HOOKS_PATH = ['git', 'config', '--unset', HOOKS_PATH_SETTING] as const;

export const NOT_INSTALLED_STATUS = 'not installed; run gspot install';

export const UNSET_HOOKS_NOTE = 'disabled hooks: unset core.hooksPath';

export const HOOK_COMMENT_LINE = /^\s*#/u;

export const HOOK_FOLDER_KINDS = new Set(['hooksPath', 'githooks', 'husky']);

export const MISE_TOOL = 'mise';

export const MISE_INSTALL_ARGUMENTS = [MISE_TOOL, 'install'] as const;

export const MISE_FORCE_FLAG = '--force';

const MISE_PLATFORMS = ['linux-x64', 'linux-arm64', 'macos-x64', 'macos-arm64', 'windows-x64'] as const;

export const MISE_LOCK_ARGUMENTS = [MISE_TOOL, 'lock', '--platform', MISE_PLATFORMS.join(',')] as const;

export const MISE_LOCKED_ENVIRONMENT = { MISE_LOCKED: '1' } as const;

export const MISE_CHECKSUM_PATTERN = /^(?:sha256|blake3):[a-f0-9]{64}$/u;

export const MISE_PLATFORM_PREFIX = 'platforms.';

export const MISE_RELEASE_HOSTS = new Set(['github.com', 'api.github.com', 'dl.deno.land']);

export const MISE_RELEASE_PROTOCOL = 'https:';

export const MISE_PROJECT_MESSAGE =
    'gspot runs mise in .gspot only when no other mise config sits beside .gspot/mise.toml. Delete the other mise files in .gspot, such as mise.local.toml, then run gspot install.';

export const MISE_STALE_PROJECT_MESSAGE =
    'gspot runs mise in .gspot only while .gspot/mise.toml is the file that gspot generates. Run gspot install.';

export const GITHUB_RATE_LIMIT = /rate limit|No lockfile URL found/iu;

export const MISE_LOCK_ENVIRONMENT = { MISE_GITHUB_ATTESTATIONS: 'false', MISE_SLSA: 'false' } as const;

export const GITHUB_TOKEN_MESSAGE =
    'GitHub limits the release lookups of mise without a token. Set GITHUB_TOKEN to a GitHub token, then run gspot install again.';

export const MISE_TOOL_NOUN = 'mise tool';

export const UV_LOCKFILE_CREDENTIAL_MESSAGE =
    'The uv lockfile holds the index credentials of the repository. gspot kept the existing files. Remove the credentials from the index URL.';

const PYTHON_VERSION = '3.13.16';

export const UV_LOCKFILE_ARGUMENTS = ['lock', '--python', PYTHON_VERSION] as const;

export const UV_INSTALL_ARGUMENTS = ['sync', '--locked', '--no-install-project', '--python', PYTHON_VERSION] as const;

export const UV_REINSTALL_FLAG = '--reinstall';

export const UV_PROJECT_INSTALL_ARGUMENTS = ['sync', '--locked', '--inexact'] as const;

export const UV_STALE_LOCKFILE = /lockfile at .* needs to be updated/u;

export const REQUIREMENT_PACKAGE_NAME = /^[^=]+/u;

export const PYTHON_DEFAULT_INDEX_ORIGIN = 'https://pypi.org';

export const PYTHON_PACKAGE_ORIGINS = ['https://files.pythonhosted.org'] as const;

export const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/iu;

export const INDEX_SETTINGS = new Set([
    'index',
    'index-url',
    'extra-index-url',
    'find-links',
    'index-strategy',
    'keyring-provider',
    'native-tls',
    'system-certs',
    'allow-insecure-host',
    'offline',
]);

export const UV_SETTINGS_FILE = 'uv.toml';

export const NPM_TOOL_PROJECT = { name: 'tools', private: true } as const;

export const PYTHON_TOOL_PROJECT = {
    name: 'tools',
    version: '0.0.0',
    'requires-python': `==${PYTHON_VERSION}`,
} as const;

export const PYTHON_TOOL_NOUN = 'Python tool';

export const PROXY_VARIABLES = ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy'] as const;

export const NETWORK_ADVICE = 'Check the network or proxy, then run again.';

export const NODE_PROXY_ADVICE = 'This Node.js sets no proxy for downloads. Run again with NODE_USE_ENV_PROXY=1.';

export const INTEGRITY = /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/u;

export const LOCKFILE_WORKSPACE_KEYS = { npm: 'packages', bun: 'workspaces', pnpm: 'importers' } as const;

export const BUN_LOCKFILE = 'bun.lock';

export const PACKAGE_MANAGER_ARGUMENTS = {
    npm: {
        lockfile: [
            'install',
            '--package-lock-only',
            '--legacy-peer-deps',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            '--omit-lockfile-registry-resolved',
        ],
        install: [
            'install',
            '--no-save',
            '--legacy-peer-deps',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            '--omit-lockfile-registry-resolved',
        ],
    },
    bun: {
        lockfile: ['install', '--lockfile-only', '--ignore-scripts', '--linker', 'hoisted', '--network-concurrency=1'],
        install: ['install', '--frozen-lockfile', '--ignore-scripts', '--linker', 'hoisted'],
    },
    pnpm: {
        lockfile: [
            'install',
            '--lockfile-only',
            '--ignore-scripts',
            '--node-linker=hoisted',
            '--config.auto-install-peers=false',
        ],
        install: [
            'install',
            '--frozen-lockfile',
            '--ignore-scripts',
            '--ignore-workspace',
            '--node-linker=hoisted',
            '--config.auto-install-peers=false',
        ],
    },
} as const;

export const PACKAGE_MANAGER_SETTINGS_NAME = /^(?:\.npmrc|\.yarnrc.*|pnpm-workspace\.yaml|bunfig\.toml)$/u;

export const NPM_CONFIG_FOLDER_VARIABLE = 'XDG_CONFIG_HOME';

export const NPM_USER_CONFIG_VARIABLE = 'NPM_CONFIG_USERCONFIG';

export const NPM_SETTING_PREFIX = 'npm_config_';

export const NOT_FOUND_STATUS = 404;

export const MILLISECONDS_PER_DAY = 86_400_000;

export const NPMRC_FILE = '.npmrc';

export const NPM_DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

export const RELEASE_AGE_VERSIONS = {
    npm: '11.19.0',
    pnpm: '10.16.0',
    bun: '1.3.0',
} as const;

export const NPM_LOCKFILE_CREDENTIAL_MESSAGE =
    'The npm lockfile holds the registry credentials of the repository. gspot kept the existing files. Remove the credentials from the registry URL.';

export const INSTALL_FAILURE = 'installation failed';

export const NPM_TOOL_NOUN = 'npm tool';

export const NODE_MISSING_MESSAGE = 'The npm tool project needs Node.js to create its lockfile. Install Node.js.';

export const LOCKFILE_FAILURE = 'lockfile resolution failed';

export const LOCKFILE_CREDENTIAL_MESSAGE =
    'The package manager wrote registry credentials into its lockfile. gspot kept the existing files.';

export const CREDENTIAL_KEY = /(?:_authToken|_auth|_password|key)$/iu;

export const ENCODED_CREDENTIAL_KEY = /(?:_auth|_password)$/u;

export const CONNECTION_URL_KEY = /registry$|(?:^|_)(?:https-)?proxy$/iu;

export const NPM_SETTING_VARIABLE_PREFIX = 'GSPOT_PACKAGE_SETTING_';

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

export const NPM_SCOPE_REGISTRY_KEY = /^@[^\s:=]+:registry$/u;

export const REGISTRY_AUTH_KEY = /^\/\/[^\s]+:(?:_authToken|_auth|username|_password|certfile|keyfile)$/u;

export const CERTIFICATE_KEYS = [':certfile', ':keyfile'] as const;

export const READ_REGISTRY_MESSAGE = 'Cannot read the registry settings. Check the .npmrc files.';

export const REGISTRY_URL_MESSAGE = 'A registry URL in the .npmrc files is not valid.';

export const NPMRC_SETTINGS_MESSAGE = 'The .npmrc settings are not valid.';

export const SECONDS_PER_DAY = 86_400;

export const RELEASE_AGE_FILES = { bun: 'bunfig.toml' } as const;

export const MINUTES_PER_DAY = 1440;

export const MISE_BIN_PATHS_ARGUMENTS = [MISE_TOOL, 'bin-paths'] as const;

export const MISE_TOOL_SOURCE_ARGUMENTS = ['ls', '--current', '--json'] as const;

export const MISE_TRUSTED_PATHS_VARIABLE = 'MISE_TRUSTED_CONFIG_PATHS';

export const MISE_CEILING_PATHS_VARIABLE = 'MISE_CEILING_PATHS';

export const UV_TOOL = 'uv';

export const UV_FLAGS = {
    project: '--project',
    with: '--with',
    directory: '--directory',
    config: '--config-file',
    python: '--python',
} as const;

export const UV_PROJECT_ENVIRONMENT = 'UV_PROJECT_ENVIRONMENT';
