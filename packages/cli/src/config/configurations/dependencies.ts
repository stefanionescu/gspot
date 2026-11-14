import { DEPENDENCY_SECTIONS } from '#cli/config/parsers/projects.ts';

// checks
export const DEPENDENCY_RULES = {
    packageManagerPin: 'package-manager-pin',
    staleLockfile: 'stale-lockfile',
    host: 'host',
    foreignLockfile: 'foreign-lockfile',
} as const;
export const DOWNLOAD_PROTOCOLS: ReadonlySet<string> = new Set([
    'http:',
    'https:',
    'git:',
    'git+http:',
    'git+https:',
    'git+ssh:',
]);
export const LOCKFILE_KEY_SUFFIX = /^["']?:[ \t]*(?:\r?\n|$)/u;
export const LOCKFILE_UPDATE_COMMANDS = {
    'bun.lock': 'bun install',
    'package-lock.json': 'npm install',
    'pnpm-lock.yaml': 'pnpm install',
} as const;
export const NPM_TOOL_PREFIX = 'npm:';
export const STALE_LOCKFILE_SECTIONS = [...DEPENDENCY_SECTIONS, 'peerDependencies'] as const;
export const UNBUNDLED_PACKAGE_MANAGERS: readonly string[] = ['pnpm', 'yarn', 'bun'];

// generated config
export const OSV_SCANNER_CHECK = 'dependencies/osv-scanner';
export const OSV_SCANNER_NOTES = [
    '# This file stops OSV-Scanner from reading an osv-scanner.toml next to a lockfile.',
    '# Accept a vulnerability with gspot ignore dependencies/osv-scanner --rule <ID> and a reason.',
];
export const SCANNER_KEY = ['install', 'security', 'scanner'] as const;
