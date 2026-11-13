import { expect, test } from 'bun:test';

import { listCodePatterns } from '#cli/configurations/language/javascript/sources.ts';

test('ESLint test patterns omit foreign extensions and retain components and shared globs', () => {
    expect(
        listCodePatterns([
            '**/test_*.py',
            '**/*.test.ts',
            '**/*.spec.vue',
            '**/*.test.astro',
            '**/tests/**',
            '**/*.{js,ts}',
        ]),
    ).toStrictEqual(['**/*.test.ts', '**/*.spec.vue', '**/*.test.astro', '**/tests/**', '**/*.{js,ts}']);
});
