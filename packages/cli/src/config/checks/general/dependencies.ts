export const STALE_LOCKFILE_SECTIONS = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
] as const;

export const DOWNLOAD_PROTOCOLS: ReadonlySet<string> = new Set([
    'http:',
    'https:',
    'git:',
    'git+http:',
    'git+https:',
    'git+ssh:',
]);

export const NPM_TOOL_PREFIX = 'npm:';

export const LOCKFILE_UPDATE_COMMANDS = {
    'bun.lock': 'bun install',
    'package-lock.json': 'npm install',
    'pnpm-lock.yaml': 'pnpm install',
} as const;

export const PACKAGE_MANAGER_HASH_SEPARATOR = '+';

export const PACKAGE_MANAGER_VERSION_SEPARATOR = '@';

export const RULES = {
    packageManagerPin: 'package-manager-pin',
    staleLockfile: 'stale-lockfile',
    host: 'host',
    foreignLockfile: 'foreign-lockfile',
} as const;

export const LOCKFILE_KEY_SUFFIX = /^["']?:[ \t]*(?:\r?\n|$)/u;
