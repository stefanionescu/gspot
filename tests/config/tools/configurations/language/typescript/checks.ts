import { TYPO } from '#tests/config/samples/spelling.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { InstalledScenario } from '#tests/types/harness/repository.ts';
import { TYPESCRIPT_PACKAGE, STRICT_COMPILER_OPTIONS } from '#tests/config/samples/typescript.ts';

import {
    TOTAL,
    WRONG,
    RECEIPT,
    DOUBLE_JS,
    CHECK_SCRIPT,
    ORDERS_TYPES,
    TOTALS_TYPES,
    MISSPELLED_FILE,
} from '#tests/config/tools/configurations/language/typescript/source.ts';

export const JAVASCRIPT_CONFIG = {
    compilerOptions: { ...STRICT_COMPILER_OPTIONS, checkJs: true, noEmit: true },
    include: ['src/**/*.js'],
};

export const REPOSITORY: InstalledScenario = {
    configurations: ['typescript'],

    tsconfig: {
        compilerOptions: { ...STRICT_COMPILER_OPTIONS, allowJs: true },
        include: ['src', 'types'],
    },
    files: {
        'package.json': TYPESCRIPT_PACKAGE,
        '.gitignore': 'node_modules/\n',
        'types/orders.ts': ORDERS_TYPES,
        'types/totals.ts': TOTALS_TYPES,
        'src/orders/total.ts': TOTAL,
        'src/orders/receipt.ts': RECEIPT,
        'src/orders/double.js': DOUBLE_JS,
        'src/main.ts': CHECK_SCRIPT,
    },
};

export const CASES: FindingCase[] = [
    {
        check: 'typescript/tsc',
        files: { 'src/orders/wrong.ts': WRONG },
        expected: { file: 'src/orders/wrong.ts', rule: 'TS2322', line: 4, column: 14 },
        corrected: {
            files: {
                'src/orders/wrong.ts':
                    '// A wrong type.\n\n/** A count that is not a number. */\nexport const count: number = 3;\n',
            },
        },
    },
    {
        check: 'javascript/eslint',
        files: {
            'src/orders/back.ts':
                "// An order module that reaches back into the entry.\nimport { receipt } from '../main.js';\n\n/** The receipt again. */\nexport const again = receipt;\n",
        },
        expected: { file: 'src/orders/back.ts', rule: 'boundaries/dependencies', line: 2 },
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
                    CHECK_SCRIPT +
                    "\nimport { unused } from './orders/unused.js';\nexport const additional = unused;\n",
            },
        },
    },
    {
        check: 'format/prettier',
        files: {
            'src/orders/ugly.ts': '// Badly formatted.\n\n/** A value. */\nexport const   ugly   =   [1,2,\n3];\n',
        },
        expected: { file: 'src/orders/ugly.ts', message: 'not formatted' },
    },
    {
        check: 'format/editorconfig-checker',
        files: {
            'src/orders/trailing.ts':
                '// Trailing spaces after this comment.   \n\n/** A value. */\nexport const orderCount = 1;\n',
        },
        expected: { file: 'src/orders/trailing.ts', line: 1, message: 'Trailing whitespace' },
    },
    {
        check: 'spelling/typos',
        files: { 'src/orders/typo.ts': MISSPELLED_FILE },
        expected: {
            file: 'src/orders/typo.ts',
            line: 1,
            column: 4,
            message: `\`${TYPO.the}\` should be \`the\``,
        },
        corrected: {
            files: {
                'src/orders/typo.ts': '// The order of things.\n\n/** A value. */\nexport const orderCount = 1;\n',
            },
        },
    },
    {
        check: 'javascript/tsc',
        files: { 'src/orders/double.js': DOUBLE_JS },
        expected: { file: 'src/orders/double.js', rule: 'TS2345', line: 13, column: 28 },
        corrected: {
            files: {
                'src/orders/double.js': DOUBLE_JS,
            },
        },
    },
];
