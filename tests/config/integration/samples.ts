import { GUIDE, README, LICENSE } from '#tests/config/samples.ts';

export const PACKAGE_MANAGER_CASES = [
    ['npm', 'package.json'],
    ['bun', 'package.json'],
    ['pnpm', 'package.json'],
    ['yarn', 'package.json'],
    ['npm', 'apps/web/package.json'],
] as const;

export const PROSE_SANDBOX = {
    configurations: ['prose'],
    files: { 'README.md': README, 'docs/guide.md': GUIDE, 'docs/second.md': GUIDE, LICENSE },
} as const;
