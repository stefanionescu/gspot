import { STRICT_COMPILER_OPTIONS } from '#tests/data/checks/typescript/projects.ts';

const TYPESCRIPT_PACKAGE = `{
    "name": "example",
    "version": "1.0.0",
    "private": true,
    "description": "A test TypeScript repository.",
    "type": "module",
    "imports": {
        "#types/*": "./types/*",
        "#entry": "./src/main.ts"
    },
    "packageManager": "bun@1.4.2",
    "engines": {
        "node": ">=22.0.0"
    }
}
`;
const DOUBLE_SOURCE = `// A plain JavaScript file that doubles a number.

/**
 * Doubles a number.
 *
 * @param {number} value the operand to multiply
 * @returns {number} twice the value
 */
export function twice(value) {
    return value * 2;
}

/** A call with the sample value. */
export const wrong = twice(3);
`;
const RECEIPT_SOURCE = `// The receipt of one order.
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
        'src/orders/double.js': DOUBLE_SOURCE,
        'src/main.ts': RECEIPT_SOURCE,
    },
} as const;
export const TYPESCRIPT_CASES = [
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
                    RECEIPT_SOURCE +
                    `
import { unused } from './orders/unused.js';
export const additional = unused;
`,
            },
        },
    },
] as const;
