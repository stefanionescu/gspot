/** The lock file each package manager writes. */
export const LOCKS = { npm: 'package-lock.json', bun: 'bun.lock', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock' } as const;

/** Authored package locations and integration owners exercised with a private registry. */
export const PACKAGE_PROJECTS = [
    ['npm', 'package.json', 'mise'],
    ['bun', 'package.json', 'mise'],
    ['pnpm', 'package.json', 'mise'],
    ['yarn', 'package.json', 'mise'],
    ['npm', 'apps/web/package.json', 'mise'],
    ['npm', 'package.json', 'none'],
] as const;
