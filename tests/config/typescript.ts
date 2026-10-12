import { TYPO } from '#tests/config/spelling.ts';

const MALFORMED_TSCONFIGS = [
    ['{"extends":"./.gspot/tsconfig.json", invalid}', 'Property assignment expected.'],
    ['null', "The root value of a 'tsconfig.json' file must be an object."],
    ['[]', "The root value of a 'tsconfig.json' file must be an object."],
] as const;

/** Compiler options required by the all-level TypeScript policy. */
const STRICT_COMPILER_OPTIONS = {
    strict: true,
    noFallthroughCasesInSwitch: true,
    noUncheckedIndexedAccess: true,
    noImplicitOverride: true,
    exactOptionalPropertyTypes: true,
    noImplicitReturns: true,
    noPropertyAccessFromIndexSignature: true,
    target: 'ES2022',
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    types: [],
    skipLibCheck: true,
} as const;

const TYPESCRIPT_PACKAGE = `{
    "name": "example",
    "version": "1.0.0",
    "private": true,
    "description": "A test TypeScript repository.",
    "type": "module",
    "imports": {
        "#types/*": "./types/*"
    },
    "packageManager": "bun@1.4.2",
    "engines": {
        "node": ">=22.0.0"
    }
}
`;

const DOUBLE_JS = `// A plain JavaScript file that doubles a number.

/**
 * Doubles a number.
 * @param {number} value the value
 * @returns {number} twice the value
 */
export function twice(value) {
    return value * 2;
}

/** A call with the sample value. */
export const wrong = twice(3);
`;

const CHECK_SCRIPT = `// The receipt of one order.
import { orderTotal } from './orders/total.js';
import { twice, wrong } from './orders/double.js';
import { receiptOptions } from './orders/receipt.js';

const formatter = new Intl.NumberFormat('en-US', receiptOptions);
const total = orderTotal([{ price: 2, quantity: 3 }], 'EUR');

/** The receipt line of the sample order. */
export const receipt = formatter.format(total.amount);

/** Twice the sample result. */
export const doubled = twice(wrong);
`;

const TYPESCRIPT_SANDBOX = {
    configurations: ['typescript'],

    tsconfig: {
        compilerOptions: { ...STRICT_COMPILER_OPTIONS, allowJs: true },
        include: ['src', 'types'],
    },
    files: {
        'jsconfig.json':
            '{ "compilerOptions": { "strict": true, "noFallthroughCasesInSwitch": true, "noUncheckedIndexedAccess": true, "noImplicitOverride": true, "exactOptionalPropertyTypes": true, "noImplicitReturns": true, "noPropertyAccessFromIndexSignature": true, "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext", "types": [], "skipLibCheck": true, "checkJs": true, "noEmit": true }, "include": ["src/**/*.js"] }\n',
        'package.json': TYPESCRIPT_PACKAGE,
        '.gitignore': 'node_modules/\n',
        'types/orders.ts': `// Type aliases of the orders module.

/** One line of an order. */
export type OrderLine = { price: number; quantity: number };
`,
        'types/totals.ts': `// Type aliases of the totals.

/** A total with its currency. */
export type Total = { amount: number; currency: string };
`,
        'src/orders/total.ts': `// The total of an order.
import type { Total } from '#types/totals.js';
import type { OrderLine } from '#types/orders.js';

/**
 * Adds up the lines of an order.
 * @param lines the lines
 * @param currency the currency of every line
 * @returns the total price
 */
export function orderTotal(lines: OrderLine[], currency: string): Total {
    let amount = 0;
    for (const line of lines) amount += line.price * line.quantity;
    return { amount, currency };
}
`,
        'src/orders/receipt.ts': `// The receipt currency format.

/** Formats the euro amounts on receipts. */
export const receiptOptions = { style: 'currency', currency: 'EUR' } as const;
`,
        'src/orders/double.js': DOUBLE_JS,
        'src/main.ts': CHECK_SCRIPT,
    },
} as const;

const TYPESCRIPT_CASES = [
    {
        check: 'typescript/tsc',
        files: {
            'src/orders/wrong.ts': `// A wrong type.

/** A count that is not a number. */
export const count: number = 'three';
`,
        },
        expected: { file: 'src/orders/wrong.ts', rule: 'TS2322', line: 4, column: 14 },
        corrected: {
            files: {
                'src/orders/wrong.ts': `// A wrong type.

/** A count that is not a number. */
export const count: number = 3;
`,
            },
        },
    },
    {
        check: 'javascript/eslint',
        files: {
            'src/orders/back.ts': `// An order module that reaches back into the entry.
import { receipt } from '../main.js';

/** The receipt again. */
export const again = receipt;
`,
        },
        expected: { file: 'src/orders/back.ts', rule: 'boundaries/dependencies', line: 2 },
    },
    {
        check: 'javascript/knip',
        files: {
            'src/orders/unused.ts': `// Nothing imports this.

/** A value nobody reads. */
export const unused = 1;
`,
        },
        expected: { file: 'src/orders/unused.ts', message: 'Unused file: src/orders/unused.ts' },
        corrected: {
            files: {
                'src/orders/unused.ts': `// Nothing imports this.

/** A value nobody reads. */
export const unused = 1;
`,
                'src/main.ts':
                    CHECK_SCRIPT +
                    `
import { unused } from './orders/unused.js';
export const additional = unused;
`,
            },
        },
    },
    {
        check: 'format/prettier',
        files: {
            'src/orders/ugly.ts': `// Badly formatted.

/** A value. */
export const   ugly   =   [1,2,
3];
`,
        },
        expected: { file: 'src/orders/ugly.ts', message: 'This file is not formatted the way Prettier formats it.' },
    },
    {
        check: 'format/editorconfig-checker',
        files: {
            'src/orders/trailing.ts': `// Trailing spaces after this comment.\u0020\u0020\u0020

/** A value. */
export const orderCount = 1;
`,
        },
        expected: { file: 'src/orders/trailing.ts', line: 1, message: 'Trailing whitespace' },
    },
    {
        check: 'spelling/typos',
        files: {
            'src/orders/typo.ts': `// ${TYPO.the} order of things.

/** A value. */
export const orderCount = 1;
`,
        },
        expected: {
            file: 'src/orders/typo.ts',
            line: 1,
            column: 4,
            message: `\`${TYPO.the}\` should be \`the\``,
        },
        corrected: {
            files: {
                'src/orders/typo.ts': `// The order of things.

/** A value. */
export const orderCount = 1;
`,
            },
        },
    },
    {
        check: 'javascript/tsc',
        files: { 'src/orders/double.js': DOUBLE_JS.replace('twice(3)', "twice('3')") },
        expected: { file: 'src/orders/double.js', rule: 'TS2345', line: 13, column: 28 },
        corrected: {
            files: {
                'src/orders/double.js': DOUBLE_JS,
            },
        },
    },
] as const;

// The entry may import the orders, and the orders only each other.

const ARCHITECTURE_SETTINGS = `
[[architecture.module]]
may_import = ["entry", "orders"]
name = "entry"
paths = ["src/main.ts"]

[[architecture.module]]
may_import = ["orders"]
name = "orders"
paths = ["src/orders/**"]
`;

// The package manifests of test TypeScript repositories.

const ZOD_PACKAGE = `{
    "name": "example",
    "version": "1.0.0",
    "description": "A test package for the tests.",
    "private": true,
    "type": "module",
    "dependencies": {
        "zod": "4.6.2"
    }
}
`;

const STRICT_TSCONFIG_TEXT =
    '{"compilerOptions":{"strict":true,"noImplicitReturns":true,"noPropertyAccessFromIndexSignature":true,"noFallthroughCasesInSwitch":true,"noUncheckedIndexedAccess":true,"noImplicitOverride":true,"exactOptionalPropertyTypes":true}}';

const COMPILER_SOURCE = 'export const value = missing;\n';

/** An imported declaration supplies a program dependency outside its configuration root. */
const IMPORTED_AMBIENT_FILES = {
    'base.json':
        '{"compilerOptions":{"strict":true,"types":[],"allowJs":true,"checkJs":true,"noEmit":true,"baseUrl":".","paths":{"shared-api":["types/api.d.ts"]}}}',
    'types/api.d.ts': 'export declare const amount: number;\n',
    'apps/web/jsconfig.json': '{"extends":"../../base.json","files":["src/main.js"]}',
    'apps/web/src/main.js': 'import { amount } from "shared-api"; export const total = amount.toFixed();\n',
    'sibling/bad.js': 'unknownValue();\n',
} as const;

const ROOT_PORT_SOURCE = 'export const port = 8080;\n';

const CHILD_PORT_SOURCE = 'export const port = 3000;\n';

const TYPED_DECLARATION = 'const counter: number = 1;';

export {
    ZOD_PACKAGE,
    COMPILER_SOURCE,
    TYPESCRIPT_CASES,
    ROOT_PORT_SOURCE,
    CHILD_PORT_SOURCE,
    TYPED_DECLARATION,
    TYPESCRIPT_SANDBOX,
    MALFORMED_TSCONFIGS,
    STRICT_TSCONFIG_TEXT,
    ARCHITECTURE_SETTINGS,
    IMPORTED_AMBIENT_FILES,
    STRICT_COMPILER_OPTIONS,
};
