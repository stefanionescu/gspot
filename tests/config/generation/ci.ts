import type { Pipeline } from '#cli/types/generation/ci.ts';

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

export const LINUX_PIPELINE: Omit<Pipeline, 'manualChecks' | 'tools'> = {
    version: '1.2.3',
    packageManager: { name: 'npm', version: '11.10.1' },
    operatingSystems: ['linux'],
    linuxRunner: 'ubuntu-24.04',
    lockfiles: ['package-lock.json', 'web/pnpm-lock.yaml'],
    hasSwift: false,
    projectInstall: [],
};

export const LINT_STEPS = [
    'Check out source',
    'Restore caches',
    'Set up mise',
    'Install gspot tools',
    'Save caches',
    'Lint',
    'Slow checks',
] as const;
