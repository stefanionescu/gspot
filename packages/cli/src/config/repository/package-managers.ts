import type { LOCKFILES } from '#cli/config/parsers/projects.ts';

// package managers
export const FROZEN_INSTALLS = {
    'package-lock.json': ['npm', 'ci'],
    'pnpm-lock.yaml': ['pnpm', 'install', '--frozen-lockfile'],
    'yarn.lock': ['yarn', 'install', '--frozen-lockfile'],
    'bun.lock': ['bun', 'install', '--frozen-lockfile'],
    'bun.lockb': ['bun', 'install', '--frozen-lockfile'],
    'uv.lock': ['uv', 'sync', '--locked'],
} as const satisfies Partial<Record<(typeof LOCKFILES)[number]['file'], readonly string[]>>;
export const NPM_TOOL = 'npm';
export const PACKAGE_MANAGERS = ['npm', 'bun', 'pnpm', 'yarn'] as const;
export const PACKAGE_MANAGER_HASH_SUFFIX = '+sha';
export const YARN_BERRY_INSTALL = ['yarn', 'install', '--immutable'] as const;
export const YARN_BERRY_MAJOR = 2;

// workspaces
export const LERNA_FILE = 'lerna.json';
export const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml';
export const RUSH_FILE = 'rush.json';
