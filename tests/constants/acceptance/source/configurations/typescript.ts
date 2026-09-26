// The literal values acceptance/source/configurations/typescript reads: names, patterns, limits, and tables.

export const PLANTED_CHECKS_MAIN = `// The receipt of one order.
import { orderTotal } from './orders/total.js';
import { receiptOptions } from './orders/receipt.js';

const formatter = new Intl.NumberFormat('en-US', receiptOptions);
const total = orderTotal([{ price: 2, quantity: 3 }], 'EUR');

/** The receipt line of the sample order. */
export const receipt = formatter.format(total.amount);
`;
export const PROJECTS_POLICY = `version = 1
level = "all"
configurations = ["typescript"]
[rules]
install = false
`;
export const TSCONFIG_PROJECT =
    '{"compilerOptions":{"composite":true,"strict":true,"types":[],"target":"ES2020"},"include":["*.ts"]}';
export const ORDERS_TYPES =
    '// Type aliases of the orders module.\n\n/** One line of an order. */\nexport type OrderLine = { price: number; quantity: number };\n';
export const TOTALS_TYPES =
    '// Type aliases of the totals.\n\n/** A total with its currency. */\nexport type Total = { amount: number; currency: string };\n';
export const TOTAL = `// The total of an order.
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
`;
export const RECEIPT = `// The receipt currency format.

/** Formats the euro amounts on receipts. */
export const receiptOptions: Intl.NumberFormatOptions = { style: 'currency', currency: 'EUR' };
`;
