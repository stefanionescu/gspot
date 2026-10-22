export const VITEST_SOURCE = `// Arithmetic the test tests call.

/**
 * Adds positive values.
 * @param values the values to total
 * @returns the positive total
 */
export function positiveTotal(values: number[]): number {
    let total = 0;
    for (const value of values) {
        if (value > 0) total += value;
    }
    return total;
}
`;

export const VITEST_PACKAGE = { name: 'example', version: '1.0.0', private: true, type: 'module' } as const;

export const UNTESTED_SOURCE = `${VITEST_SOURCE}
/**
 * Triples a number.
 * @param value the number.
 * @returns three times the number.
 */
export function triple(value: number): number {
    return value * 3;
}
`;

const VITEST_MATH_TEST = `import { test, expect } from 'vitest';
import { positiveTotal } from './public.js';

test('adds only positive values', () => {
    expect(positiveTotal([2, 3])).toBe(5);
    expect(positiveTotal([-2, 3])).toBe(3);
    expect(positiveTotal([])).toBe(0);
});
`;

export const VITEST_PROJECT_FILES = {
    '.gitignore': 'node_modules\ncoverage\n',
    'vitest.config.mjs': "export default { test: { include: ['src/*.test.ts'] } };\n",
    'src/public.ts': VITEST_SOURCE,
    'src/math.test.ts': VITEST_MATH_TEST,
} as const;
