import { STRICT_COMPILER_OPTIONS } from '#tests/config/checks/language/typescript.ts';

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
 * Doubles a number, and returns an infinite number unchanged.
 *
 * @param {number} value the operand to multiply
 * @returns {number} twice the value
 */
export function twice(value) {
    if (Number.isNaN(value)) throw new RangeError('A missing number has no double.');
    if (!Number.isFinite(value)) return value;
    return value * 2;
}

/** A call with the sample value. */
export const wrong = twice(3);
`;

export const RECEIPT_SOURCE = `// The receipt of one order.
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

/** The orders may import the types, and the entry may import the orders. */
export const ARCHITECTURE_SETTINGS = `
[[import_rule]]
name = "types"
paths = ["types/**"]

[[import_rule]]
name = "orders"
paths = ["src/orders/**"]

[[import_rule]]
name = "entry"
paths = ["src/main.ts"]
`;
