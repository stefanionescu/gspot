import { NPM_BIN_FOLDER } from '#cli/config/tools/programs.ts';
import { HOOKS_PATH_SETTING } from '#cli/config/repository/setup.ts';
import type { ToolPackageManagerName } from '#cli/types/repository.ts';
import { GIT_PROGRAM, BYTES_PER_MEGABYTE } from '#cli/config/system.ts';
import { FENCE_GRAMMARS, type GRAMMAR_NAMES } from '#cli/config/parsers/code.ts';

// credentials
export const EMPTY_OUTPUT_MESSAGE = 'The command printed no output.';
export const INSTALL_OUTPUT_LIMIT = 4000;
export const LOCKFILE_URL_PASSWORD = /https?:\/\/[^\s"'/:]*:[^\s"'/]+@/iu;
export const REDACTED = '[redacted]';
export const URL_CREDENTIALS = /(https?:\/\/)[^\s/@]+@/giu;

// downloads
export const NETWORK_ADVICE = 'Check the network or proxy, then run again.';
export const NODE_PROXY_ADVICE = 'This Node.js sets no proxy for downloads. Run again with NODE_USE_ENV_PROXY=1.';
export const NOT_FOUND_STATUS = 404;
export const PROXY_VARIABLES = ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy'] as const;

// grammar downloads
export const CONFIGURATION_GRAMMARS: Readonly<Record<string, ReadonlyArray<(typeof GRAMMAR_NAMES)[number]>>> = {
    bash: ['bash'],
    css: ['css'],
    'github-actions': ['bash'],
    gspot: ['html'],
    html: ['html'],
    javascript: ['javascript', 'typescript', 'tsx', 'html'],
    markdown: FENCE_GRAMMARS,
    python: ['python'],
    site: ['html'],
    swift: ['swift'],
    typescript: ['javascript', 'typescript', 'tsx', 'html'],
};
export const GRAMMAR_ARCHIVE_LIMIT = 32 * BYTES_PER_MEGABYTE;
export const GRAMMAR_RELEASES: Readonly<Record<(typeof GRAMMAR_NAMES)[number], { sha256: string; url: string }>> = {
    bash: {
        sha256: '8292919c88a0f7d3fb31d0cd0253ca5a9531bc1ede82b0537f2c63dd8abe6a7a',
        url: 'https://github.com/tree-sitter/tree-sitter-bash/releases/download/v0.25.1/tree-sitter-bash.wasm',
    },
    css: {
        sha256: '8a23977fe271357cce6f254ef88c9bebf3854602d8046605aef6a45c02135c59',
        url: 'https://github.com/tree-sitter/tree-sitter-css/releases/download/v0.25.0/tree-sitter-css.wasm',
    },
    html: {
        sha256: 'c48fcd82c7ea8bf943180088ba7f28c48b2bb5287874179168bf9d31e394cf85',
        url: 'https://github.com/tree-sitter/tree-sitter-html/releases/download/v0.23.2/tree-sitter-html.wasm',
    },
    javascript: {
        sha256: '5fb488d0cabb4775a594bab85682de5ad6ce83c0d6ac997a9f82dd084d571240',
        url: 'https://github.com/tree-sitter/tree-sitter-javascript/releases/download/v0.25.0/tree-sitter-javascript.wasm',
    },
    python: {
        sha256: '16108b50df4ee9a30168794252ab55e7c93bfc5765d7fa0aa3e335752c515f47',
        url: 'https://github.com/tree-sitter/tree-sitter-python/releases/download/v0.25.0/tree-sitter-python.wasm',
    },
    typescript: {
        sha256: '778025db5a8be0e70f8ccc3671e486dfeddd048c25d9e8a70c26de2e1bf6f97d',
        url: 'https://github.com/tree-sitter/tree-sitter-typescript/releases/download/v0.23.2/tree-sitter-typescript.wasm',
    },
    tsx: {
        sha256: '79e5da75ea62855a0cd67177685f0164eac87d5f630b3cbe1e0a099751ad30f8',
        url: 'https://github.com/tree-sitter/tree-sitter-typescript/releases/download/v0.23.2/tree-sitter-tsx.wasm',
    },
    swift: {
        sha256: '0258a7ef17303a8079ffe0748b3583d59656b5c3e8653fca7b6451b3e6689eb2',
        url: 'https://github.com/alex-pinkus/tree-sitter-swift/releases/download/0.7.3/tree-sitter-swift.wasm',
    },
};
export const GRAMMAR_TOOL_NOUN = 'grammar';

// hooks
export const CHECK_HOOKS = ['pre-commit', 'pre-push', 'commit-msg'] as const;
export const HOOK_CHECKS = {
    'pre-commit': { arguments: 'check --staged --only commit', stages: ['commit'] },
    'pre-push': { arguments: 'check --hook pre-push -- "$@"', stages: ['push'] },
    'commit-msg': { arguments: 'check --hook commit-msg -- "$1"', stages: ['message'] },
} as const satisfies Record<(typeof CHECK_HOOKS)[number], { arguments: string; stages: readonly string[] }>;
export const HOOK_FOLDER_KINDS = new Set(['hooksPath', 'githooks', 'husky']);
export const HOOK_PROGRAM = `${NPM_BIN_FOLDER}/gspot`;
export const NOT_INSTALLED_STATUS = 'not installed; run gspot install';
export const SET_HOOKS_PATH = [GIT_PROGRAM, 'config', HOOKS_PATH_SETTING] as const;
export const UNSET_HOOKS_NOTE = 'disabled hooks: unset core.hooksPath';
export const UNSET_HOOKS_PATH = [GIT_PROGRAM, 'config', '--unset', HOOKS_PATH_SETTING] as const;

// npm project
export const CI_NODE = 'node@24.20.0';
export const DELETED_LOCKFILE_MESSAGE =
    'npm wrote registry credentials into the lockfile of the tool project, so gspot deleted that lockfile. Remove the credentials from the registry URL, then run gspot install again.';
export const INSTALL_FAILURE = 'installation failed';
export const INTEGRITY = /^sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}$/u;
export const LOCKFILE_CREDENTIAL_MESSAGE =
    'The package manager wrote registry credentials into its lockfile. gspot kept the existing files.';
export const LOCKFILE_FAILURE = 'lockfile resolution failed';
export const LOCKFILE_WORKSPACE_KEYS = { npm: 'packages', bun: 'workspaces', pnpm: 'importers' } as const;
export const LOCK_ONLY_FLAG = '--package-lock-only';
export const NODE_MISSING_MESSAGE = 'The npm tool project needs Node.js to create its lockfile. Install Node.js.';
export const NPM_CONFIG_FOLDER_VARIABLE = 'XDG_CONFIG_HOME';
export const NPM_DEFAULT_REGISTRY = 'https://registry.npmjs.org/';
export const NPM_LOCKFILE_CREDENTIAL_MESSAGE =
    'The npm lockfile holds the registry credentials of the repository. gspot kept the existing files. Remove the credentials from the registry URL.';
export const NPM_TOOL_NOUN = 'npm tool';
export const NPM_USER_CONFIG_VARIABLE = 'NPM_CONFIG_USERCONFIG';
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
export const PACKAGE_MANAGER_UPGRADES: Record<ToolPackageManagerName, string> = {
    npm: 'npm install --global npm@latest',
    pnpm: 'pnpm self-update',
    bun: 'bun upgrade',
};

// npm registry
export const CERTIFICATE_KEYS = [':certfile', ':keyfile'] as const;
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
export const CONNECTION_URL_KEY = /registry$|(?:^|_)(?:https-)?proxy$/iu;
export const CREDENTIAL_KEY = /(?:_authToken|_auth|_password|key)$/iu;
export const ENCODED_CREDENTIAL_KEY = /(?:_auth|_password)$/u;
export const NPMRC_FILE = '.npmrc';
export const NPMRC_SETTINGS_MESSAGE = 'The .npmrc settings are not valid.';
export const NPM_SCOPE_REGISTRY_KEY = /^@[^\s:=]+:registry$/u;
export const NPM_SETTING_PREFIX = 'npm_config_';
export const NPM_SETTING_VARIABLE_PREFIX = 'GSPOT_PACKAGE_SETTING_';
export const READ_REGISTRY_MESSAGE = 'Cannot read the registry settings. Check the .npmrc files.';
export const REGISTRY_AUTH_KEY = /^\/\/[^\s]+:(?:_authToken|_auth|username|_password|certfile|keyfile)$/u;
export const REGISTRY_URL_MESSAGE = 'A registry URL in the .npmrc files is not valid.';

// release age
export const BUNFIG_FILE = 'bunfig.toml';
export const RELEASE_AGE_VERSIONS = {
    npm: '11.19.0',
    pnpm: '10.16.0',
    bun: '1.3.0',
} as const;

// uv and pypi
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
export const PYTHON_DEFAULT_INDEX_ORIGIN = 'https://pypi.org';
export const PYTHON_PACKAGE_ORIGINS = ['https://files.pythonhosted.org'] as const;
export const PYTHON_TOOL_NOUN = 'Python tool';
const PYTHON_VERSION = '3.13.16';
export const REQUIREMENT_PACKAGE_NAME = /^[^=]+/u;
export const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/iu;
export const UV_CHECK_FLAG = '--check';
export const UV_FLAGS = {
    project: '--project',
    with: '--with',
    directory: '--directory',
    config: '--config-file',
    python: '--python',
} as const;
export const UV_INSTALL_ARGUMENTS = ['sync', '--locked', '--no-install-project', '--python', PYTHON_VERSION] as const;
export const UV_LOCKFILE_ARGUMENTS = ['lock', '--python', PYTHON_VERSION] as const;
export const UV_LOCKFILE_CREDENTIAL_MESSAGE =
    'The uv lockfile holds the index credentials of the repository. gspot kept the existing files. Remove the credentials from the index URL.';
export const UV_PROJECT_ENVIRONMENT = 'UV_PROJECT_ENVIRONMENT';
export const UV_PROJECT_INSTALL_ARGUMENTS = ['sync', '--locked', '--inexact'] as const;
export const UV_REINSTALL_FLAG = '--reinstall';
export const UV_SETTINGS_FILE = 'uv.toml';
export const UV_STALE_LOCKFILE = /lockfile at .* needs to be updated/u;

// tool projects
export const NPM_TOOL_PROJECT = { name: 'tools', private: true } as const;
export const PYTHON_TOOL_PROJECT = {
    name: 'tools',
    version: '0.0.0',
    'requires-python': `==${PYTHON_VERSION}`,
} as const;
