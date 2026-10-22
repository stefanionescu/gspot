export const TOOL_REQUIREMENTS = [
    {
        name: 'a Next major requirement is accepted',
        dependency: '@next/eslint-plugin-next',
        version: '^15',
        accepted: true,
    },
    {
        name: 'an exact Next manifest pin is accepted',
        dependency: '@next/eslint-plugin-next',
        version: '16.3.6',
        accepted: true,
    },
    {
        name: 'a Next minor range is refused',
        dependency: '@next/eslint-plugin-next',
        version: '^16.3.6',
        accepted: false,
    },
    { name: 'a non-Next range is refused', dependency: 'eslint', version: '^9', accepted: false },
    { name: 'a non-Next exact pin is accepted', dependency: 'eslint', version: '9.39.5', accepted: true },
] as const;

/** The package managers and dependency files that a package project test covers. */
export const PACKAGE_MANAGER_CASES = [
    ['npm', 'package.json'],
    ['bun', 'package.json'],
    ['pnpm', 'package.json'],
    ['yarn', 'package.json'],
    ['npm', 'apps/web/package.json'],
] as const;
