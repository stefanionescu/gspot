export const PACKAGE_HOOK_CONFIGURATIONS = ['null', '{}', '{"pre-commit":"echo authored"}'] as const;

export const LINKED_HOOK_FOLDERS = [
    { path: '.husky', kind: 'husky' } as const,
    { path: '.githooks', kind: 'githooks' } as const,
];

export const LINKED_RULE_FOLDERS = ['.cursor/rules', '.claude/rules'];

export const LINKED_HOOK_FILES = [
    { path: '.lefthook.yml', kind: 'lefthook' } as const,
    { path: '.pre-commit-config.yaml', kind: 'pre-commit' } as const,
];

export const LEFTHOOK_FILES = ['lefthook.yml', '.config/lefthook.yml', 'lefthook-local.yml'];

/** Native read errors remain actionable failures after containment is checked. */
export const SURVEY_READ_ERRORS = ['EIO', 'EACCES'];

export const RUNNER_CASES = [
    { name: 'an empty repository', paths: [], runner: 'none', runnerFile: undefined } as const,
    { name: 'a Python manifest', paths: ['pyproject.toml'], runner: 'none', runnerFile: undefined } as const,
    { name: 'a Python lockfile', paths: ['uv.lock'], runner: 'none', runnerFile: undefined } as const,
    {
        name: 'Python project inputs',
        paths: ['pyproject.toml', 'uv.lock'],
        runner: 'none',
        runnerFile: undefined,
    } as const,
    { name: 'an npm manifest', paths: ['package.json'], runner: 'npm', runnerFile: 'package.json' } as const,
    {
        name: 'an npm lockfile',
        paths: ['package.json', 'package-lock.json'],
        runner: 'npm',
        runnerFile: 'package.json',
    } as const,
    {
        name: 'a Bun text lockfile',
        paths: ['package.json', 'bun.lock'],
        runner: 'bun',
        runnerFile: 'package.json',
    } as const,
    {
        name: 'a Bun binary lockfile',
        paths: ['package.json', 'bun.lockb'],
        runner: 'bun',
        runnerFile: 'package.json',
    } as const,
    {
        name: 'a pnpm lockfile',
        paths: ['package.json', 'pnpm-lock.yaml'],
        runner: 'pnpm',
        runnerFile: 'package.json',
    } as const,
    {
        name: 'a Yarn lockfile',
        paths: ['package.json', 'yarn.lock'],
        runner: 'yarn',
        runnerFile: 'package.json',
    } as const,
    {
        name: 'mise.toml ahead of project lockfiles',
        paths: ['package.json', 'bun.lock', 'pyproject.toml', 'uv.lock', 'mise.toml'],
        runner: 'mise',
        runnerFile: 'mise.toml',
    } as const,
    {
        name: '.config/mise/config.toml ahead of project lockfiles',
        paths: ['package.json', 'bun.lock', 'pyproject.toml', 'uv.lock', '.config/mise/config.toml'],
        runner: 'mise',
        runnerFile: '.config/mise/config.toml',
    } as const,
];
