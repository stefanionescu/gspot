// The literal values checks/dependencies reads: names, patterns, limits, and tables.

export const BUNFIG = 'bunfig.toml';
export const DEFAULT_AGE_DAYS = 7;
export const NPM_MANIFEST = 'package.json';
export const DEPENDENCY_TABLES = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
export const EXACT_VERSION = /^\d+\.\d+\.\d+$|^\d+\.\d+\.\d+[-+][\w.+-]+$/u;
export const NON_REGISTRY_VERSION = /^(?:workspace:|file:|link:|git\+|github:|https?:|catalog:|npm:)/u;
export const LOCKFILE_URL = /\b(?:https?|git\+https?|git\+ssh|git):\/\/[^\s"',)\]]+/gu;
export const STALE_LOCK_DIAGNOSTICS: Record<string, RegExp> = {
    bun: /lockfile had changes, but lockfile is frozen/u,
    npm: /can only install packages when your package\.json and package-lock\.json or npm-shrinkwrap\.json are in sync/u,
    pnpm: /ERR_PNPM_(?:OUTDATED_LOCKFILE|FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE)/u,
    uv: /lockfile[\s\S]*needs to be updated/u,
    yarn: /Your lockfile needs to be updated|YN0028|lockfile would have been modified/u,
};
export const FROZEN_INSTALLS: Record<string, string[]> = {
    'bun.lock': ['bun', 'install', '--frozen-lockfile', '--dry-run'],
    'package-lock.json': ['npm', 'ci', '--dry-run', '--ignore-scripts'],
    'pnpm-lock.yaml': ['pnpm', 'install', '--frozen-lockfile', '--lockfile-only'],
    'yarn.lock': ['yarn', 'install', '--frozen-lockfile', '--ignore-scripts', '--non-interactive'],
    'uv.lock': ['uv', 'lock', '--check'],
};
