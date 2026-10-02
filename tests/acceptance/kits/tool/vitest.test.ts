// Planted repository for the vitest configuration: a function no test calls, and a focused test.
import { plantedCases } from '#tests/support/cli/planted.ts';
import { TEST, UNTESTED, VITEST_SOURCE, VITEST_PACKAGE } from '#tests/inputs/acceptance/source/kits/kits.ts';

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
