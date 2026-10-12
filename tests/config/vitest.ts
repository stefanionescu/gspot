import { STRICT_COMPILER_OPTIONS } from '#tests/config/typescript.ts';

const VITEST_SOURCE = `// Arithmetic the test tests call.

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

const VITEST_PACKAGE = { name: 'example', version: '1.0.0', private: true, type: 'module' } as const;

const UNTESTED_SOURCE = `${VITEST_SOURCE}
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

const VITEST_SANDBOX = {
    configurations: ['typescript', 'vitest'],
    tsconfig: {
        compilerOptions: STRICT_COMPILER_OPTIONS,
        include: ['src'],
    },
    files: {
        '.gitignore': 'node_modules\ncoverage\n',
        'vitest.config.mjs': "export default { test: { include: ['src/*.test.ts'] } };\n",
        'src/public.ts': VITEST_SOURCE,
        'src/math.test.ts': VITEST_MATH_TEST,
    },
} as const;

const VITEST_CASES = [
    {
        check: 'vitest/coverage',
        files: { 'src/public.ts': UNTESTED_SOURCE },
        expected: { message: 'Coverage for functions (50%) does not meet global threshold (80%)' },
        corrected: {
            files: {
                'src/public.ts': UNTESTED_SOURCE,
                'src/math.test.ts': `import { test, expect } from 'vitest';
import { positiveTotal, triple } from './public.js';

test('adds only positive values', () => {
    expect(positiveTotal([2, 3])).toBe(5);
    expect(positiveTotal([-2, 3])).toBe(3);
    expect(positiveTotal([])).toBe(0);
});
\ntest("triples a number", () => { expect(triple(3)).toBe(9); });\n`,
            },
        },
    },
] as const;

export { VITEST_CASES, VITEST_SOURCE, VITEST_PACKAGE, VITEST_SANDBOX, UNTESTED_SOURCE };
