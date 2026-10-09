import { TYPO } from '#tests/config/samples/spelling.ts';

// The entry may import the orders, and the orders only each other.

export const ARCHITECTURE =
    '\n[[architecture.modules]]\nmay_import = ["entry", "orders"]\nname = "entry"\npaths = ["src/main.ts"]\n\n[[architecture.modules]]\nmay_import = ["orders"]\nname = "orders"\npaths = ["src/orders/**"]\n';

export const CHECK_SCRIPT = `// The receipt of one order.
import { wrong } from './orders/double.js';
import { orderTotal } from './orders/total.js';
import { receiptOptions } from './orders/receipt.js';

const formatter = new Intl.NumberFormat('en-US', receiptOptions);
const total = orderTotal([{ price: 2, quantity: 3 }], 'EUR');

/** The receipt line of the sample order. */
export const receipt = formatter.format(total.amount);

/** Twice the sample result. */
export const doubled = wrong + wrong;
`;

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

export const WRONG =
    "// A wrong type.\n\n/** A count that is not a number. */\nexport const count: number = 'three';\n";

export const MISSPELLED_FILE = `// ${TYPO.the} order of things.\n\n/** A value. */\nexport const orderCount = 1;\n`;

export const DOUBLE_JS =
    '// A plain JavaScript file with a wrong call.\n\n/**\n * Doubles a number.\n * @param {number} value the value\n * @returns {number} twice the value\n */\nexport function twice(value) {\n    return value * 2;\n}\n\n/** A call with a string. */\nexport const wrong = twice(3);\n';

export const TSCONFIG_PROJECT =
    '{"compilerOptions":{"composite":true,"strict":true,"types":[],"target":"ES2020"},"include":["*.ts"]}';

export const AUTHORED_TSCONFIG = `{
    // The application owns its build and module settings.
    "compilerOptions": {
        "strict": false,
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "types": [],
        "incremental": true,
        "tsBuildInfoFile": %BUILD_INFO%
    },
    "include": ["src"],
}\n`;

/** Native compiler output boundaries have distinct exit contracts. */
export const OUTDIR_CASES = [
    { name: 'an absolute outDir outside the project is refused with exit 2', kind: 'absolute', code: 2 },
    { name: 'an outDir through a linked node_modules writes nothing outside the repository', kind: 'symlink', code: 0 },
];
