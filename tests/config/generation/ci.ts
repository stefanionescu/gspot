export const SETUP_CASES = [
    ['github', 0],
    ['github', 29],
    ['gitlab', 0],
    ['gitlab', 29],
] as const;

export const SETUP_ARGUMENTS = [
    '',
    'two words',
    "a'b",
    '$(touch unexpected)',
    'x; touch unexpected',
    'line\nbreak',
] as const;

export const LINUX_PIPELINE = {
    version: '1.2.3',
    packageManager: { name: 'npm' as const, version: '11.10.1' },
    operatingSystems: ['linux' as const],
    linuxRunner: 'ubuntu-24.04' as const,
    lockfiles: ['package-lock.json', 'web/pnpm-lock.yaml'],
    hasSwift: false,
    projectInstall: [],
    packageManagers: ['npm' as const, 'pnpm' as const],
};

export const LINT_STEPS = [
    'Check out source',
    'Restore caches',
    'Set up mise',
    'Install gspot',
    'Install gspot tools',
    'Save caches',
    'Lint',
] as const;
