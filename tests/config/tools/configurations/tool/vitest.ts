import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';

export const VITEST_SOURCE =
    '// Arithmetic the test tests call.\n\n/**\n * Adds positive values.\n * @param values the values to total\n * @returns the positive total\n */\nexport function positiveTotal(values: number[]): number {\n    let total = 0;\n    for (const value of values) {\n        if (value > 0) total += value;\n    }\n    return total;\n}\n';

export const VITEST_PACKAGE =
    '{\n    "name": "example",\n    "version": "1.0.0",\n    "private": true,\n    "type": "module",\n    "devDependencies": {\n        "vitest": "4.1.11"\n    }\n}\n';

export const UNTESTED = `${VITEST_SOURCE}\n/**\n * Triples a number.\n * @param value the number\n * @returns three times the number\n */\nexport function triple(value: number): number {\n    return value * 3;\n}\n`;

export const TEST =
    "import { test, expect } from 'vitest';\nimport { positiveTotal } from './public.js';\n\ntest('adds only positive values', () => {\n    expect(positiveTotal([2, 3])).toBe(5);\n    expect(positiveTotal([-2, 3])).toBe(3);\n    expect(positiveTotal([])).toBe(0);\n});\n";

export const REPOSITORY: InstalledScenario = {
    configurations: ['typescript', 'vitest'],
    files: {
        'package.json': VITEST_PACKAGE,
        '.gitignore': 'node_modules\ncoverage\n',
        'tsconfig.json':
            '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "noImplicitReturns": true,\n        "noPropertyAccessFromIndexSignature": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": [\n        "src"\n    ]\n}' +
            '\n',
        'vitest.config.mjs': "export default { test: { include: ['src/*.test.ts'] } };\n",
        'src/public.ts': VITEST_SOURCE,
        'src/math.test.ts': TEST,
    },
};

export const TRIPLE_TEST = '\ntest("triples a number", () => { expect(triple(3)).toBe(9); });\n';

export const CASES: FindingCase[] = [
    {
        check: 'vitest/coverage',
        files: { 'src/public.ts': UNTESTED },
        expected: { message: '80%' },
        corrected: { files: { 'src/public.ts': UNTESTED, 'src/math.test.ts': TEST } },
    },
];
