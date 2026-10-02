// Planted repository for the vitest configuration: a function no test calls, and a focused test.
import { plantedCases } from '#tests/harness/planted/cases.ts';

const VITEST_SOURCE =
    '// Arithmetic the planted tests call.\n\n/**\n * Adds positive values.\n * @param values the values to total\n * @returns the positive total\n */\nexport function positiveTotal(values: number[]): number {\n    let total = 0;\n    for (const value of values) {\n        if (value > 0) total += value;\n    }\n    return total;\n}\n';

const VITEST_PACKAGE =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "devDependencies": {\n        "vitest": "4.1.11"\n    }\n}\n';

const UNTESTED = `${VITEST_SOURCE}\n/**\n * Triples a number.\n * @param value the number\n * @returns three times the number\n */\nexport function triple(value: number): number {\n    return value * 3;\n}\n`;

const TEST =
    "import { test, expect } from 'vitest';\nimport { positiveTotal } from './public.js';\n\ntest('adds only positive values', () => {\n    expect(positiveTotal([2, 3])).toBe(5);\n    expect(positiveTotal([-2, 3])).toBe(3);\n    expect(positiveTotal([])).toBe(0);\n});\n";

const TRIPLED =
    TEST.replace('{ positiveTotal }', '{ positiveTotal, triple }') +
    '\ntest("triples a number", () => { expect(triple(3)).toBe(9); });\n';

plantedCases(
    'the vitest configuration',
    {
        kits: ['typescript', 'vitest'],
        files: {
            'package.json': VITEST_PACKAGE,
            '.gitignore': 'node_modules\ncoverage\n',
            'tsconfig.json':
                '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src"]\n}\n',
            'src/public.ts': VITEST_SOURCE,
            'src/math.test.ts': TEST,
        },
    },
    [
        {
            check: 'vitest/coverage',
            files: { 'src/public.ts': UNTESTED },
            expected: { message: 'Coverage for functions (50%) does not meet global threshold (80%)' },
            corrected: { files: { 'src/public.ts': UNTESTED, 'src/math.test.ts': TRIPLED } },
        },
    ],
);
