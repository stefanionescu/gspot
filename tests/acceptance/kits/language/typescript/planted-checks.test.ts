// Source CLI journeys: every check of the typescript configuration reports its planted defect and accepts the correction.
import { test, expect } from 'bun:test';
import { run } from '#tests/harness/cli/command.ts';
import type { FindingCase } from '#tests/types/cli.ts';
import { PLANTED_TIMEOUT_MS } from '#tests/inputs/cli.ts';
import { TYPESCRIPT_PACKAGE } from '#tests/harness/cli/typescript.ts';
import { runPlanted, plantedCases } from '#tests/harness/planted/cases.ts';

import {
    TOTAL,
    RECEIPT,
    ORDERS_TYPES,
    TOTALS_TYPES,
    PLANTED_CHECKS_MAIN,
} from '#tests/inputs/acceptance/source/kits/typescript.ts';

// Built from two halves, so the spelling fixer of this repository never corrects the planted typo.
const MISSPELLED = ['Te', 'h'].join('');
const WRONG = "// A wrong type.\n\n/** A count that is not a number. */\nexport const count: number = 'three';\n";
const TYPO = `// ${MISSPELLED} order of things.\n\n/** A value. */\nexport const orderCount = 1;\n`;
const PLAIN_JS =
    '// A plain JavaScript file with a wrong call.\n\n/**\n * Doubles a number.\n * @param {number} value the value\n * @returns {number} twice the value\n */\nexport function twice(value) {\n    return value * 2;\n}\n\n/** A call with a string. */\nexport const wrong = twice("x");\n';

const CASES: FindingCase[] = [
    {
        check: 'typescript/tsc',
        files: { 'src/orders/wrong.ts': WRONG },
        expected: { file: 'src/orders/wrong.ts', rule: 'TS2322', line: 4, column: 14 },
        corrected: { files: { 'src/orders/wrong.ts': WRONG.replace("'three'", '3') } },
    },
    {
        check: 'typescript/eslint',
        files: {
            'src/orders/paused.ts':
                '// A debugger statement left behind.\n\n/**\n * Doubles a value.\n * @param value the value\n * @returns twice the value\n */\nexport function twice(value: number): number {\n    debugger;\n    return value * 2;\n}\n',
        },
        expected: { file: 'src/orders/paused.ts', rule: 'no-debugger', line: 9, column: 5 },
    },
    {
        check: 'javascript/knip',
        files: {
            'src/orders/unused.ts':
                '// Nothing imports this.\n\n/** A value nobody reads. */\nexport const unused = 1;\n',
        },
        expected: { file: 'src/orders/unused.ts', message: 'src/orders/unused.ts' },
        corrected: {
            files: {
                'src/orders/unused.ts':
                    '// Nothing imports this.\n\n/** A value nobody reads. */\nexport const unused = 1;\n',
                'src/main.ts':
                    PLANTED_CHECKS_MAIN +
                    "\nimport { unused } from './orders/unused.js';\nexport const additional = unused;\n",
            },
        },
    },
    {
        check: 'formatting/prettier',
        files: {
            'src/orders/ugly.ts': '// Badly formatted.\n\n/** A value. */\nexport const   ugly   =   [1,2,\n3];\n',
        },
        expected: { file: 'src/orders/ugly.ts', message: 'This file is not formatted the way Prettier formats it.' },
    },
    {
        check: 'formatting/editorconfig-checker',
        files: {
            'src/orders/trailing.ts':
                '// Trailing spaces after this comment.   \n\n/** A value. */\nexport const orderCount = 1;\n',
        },
        expected: { file: 'src/orders/trailing.ts', line: 1, message: 'Trailing whitespace' },
    },
    {
        check: 'spelling/typos',
        files: { 'src/orders/typo.ts': TYPO },
        expected: {
            file: 'src/orders/typo.ts',
            line: 1,
            column: 4,
            message: `\`${MISSPELLED}\` should be \`The\``,
        },
        corrected: { files: { 'src/orders/typo.ts': TYPO.replace(MISSPELLED, 'The') } },
    },
    {
        check: 'javascript/checkjs',
        files: { 'src/orders/legacy.js': PLAIN_JS },
        expected: { file: 'src/orders/legacy.js', rule: 'TS2345', line: 13, column: 28 },
        corrected: { files: { 'src/orders/legacy.js': PLAIN_JS.replace('twice("x")', 'twice(3)') } },
    },
];

plantedCases(
    'the typescript configuration',
    {
        kits: ['typescript'],
        without: [],
        files: {
            'package.json': TYPESCRIPT_PACKAGE,
            'tsconfig.json':
                '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src", "types"]\n}\n',
            '.gitignore': 'node_modules/\n',
            'types/orders.ts': ORDERS_TYPES,
            'types/totals.ts': TOTALS_TYPES,
            'src/orders/total.ts': TOTAL,
            'src/orders/receipt.ts': RECEIPT,
            'src/main.ts': PLANTED_CHECKS_MAIN,
        },
    },
    CASES,
    (planted) => {
        test(
            'every check passes on the clean repository',
            async () => {
                const { root, environment } = planted();
                const whole = await run(root, ['check'], environment);
                expect(whole.code, whole.stdout).toBe(0);
            },
            PLANTED_TIMEOUT_MS * 4,
        );

        // typos forgets its exclude list for a file named on the command line unless it is told to keep it.
        test(
            'spelling/typos keeps its exclusions for a file named on the command line',
            async () => {
                const { root, environment } = planted();
                const excluded = await runPlanted(
                    root,
                    {
                        check: 'spelling/typos',
                        files: { 'assets/mark.svg': `<svg><title>${MISSPELLED}</title></svg>\n` },
                    },
                    environment,
                );
                expect(excluded.code, excluded.stdout).toBe(0);
            },
            PLANTED_TIMEOUT_MS * 2,
        );
    },
);
