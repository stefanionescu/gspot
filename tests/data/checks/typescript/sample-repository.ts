import { TYPO } from '#tests/data/checks/spelling.ts';
import { STRICT_COMPILER_OPTIONS } from '#tests/data/checks/typescript/projects.ts';
import { DOUBLE_JS, CHECK_SCRIPT, TYPESCRIPT_PACKAGE } from '#tests/data/checks/javascript/tsc.ts';

export const TYPESCRIPT_SANDBOX = {
    configurations: ['typescript'],

    tsconfig: {
        compilerOptions: { ...STRICT_COMPILER_OPTIONS, allowJs: true },
        include: ['src', 'types'],
    },
    files: {
        'jsconfig.json': `${JSON.stringify({
            compilerOptions: { ...STRICT_COMPILER_OPTIONS, checkJs: true, noEmit: true },
            include: ['src/**/*.js'],
        })}\n`,
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
 *
 * @param lines the purchased quantities and unit prices
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

export const TYPESCRIPT_CASES = [
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
import { receipt } from '#entry';

/**
 * Prefix the entry receipt with the order label.
 *
 * @returns the text shown on the order screen
 */
export function receiptLabel(): string {
    return 'Order: ' + receipt;
}
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
        expected: { file: 'src/orders/ugly.ts', message: 'Not formatted the way Prettier formats it.' },
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
        expected: { file: 'src/orders/double.js', rule: 'TS2345', line: 14, column: 28 },
        corrected: {
            files: {
                'src/orders/double.js': DOUBLE_JS,
            },
        },
    },
] as const;

// The entry may import the orders, and the orders only each other.

export const ARCHITECTURE_SETTINGS = `
[[import_rule]]
can_also_import = ["orders"]
name = "orders"
paths = ["src/orders/**"]

[[import_rule]]
can_also_import = ["entry", "orders"]
name = "entry"
paths = ["src/main.ts"]
`;
