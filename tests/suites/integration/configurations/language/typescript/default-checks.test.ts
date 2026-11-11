import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

import { beforeAll, describe, expect, test } from 'bun:test';

import { LICENSE, README } from '#tests/config/setup/configurations.ts';
import { STRICT_COMPILER_OPTIONS } from '#tests/config/setup/languages.ts';
import { parseCheckReport, spawnGspot } from '#tests/setup/cli/commands.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { shareInstalledSandbox } from '#tests/setup/sandboxes/create.ts';

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
Doubles a number, and returns an infinite number unchanged.

@param {number} value the operand to multiply
@returns {number} twice the value
*/
export function twice(value) {
    if (Number.isNaN(value)) throw new RangeError('A missing number has no double.');
    return Number.isFinite(value) ? value * 2 : value;
}

/**
A call with the sample value.
*/
export const wrong = twice(3);
`;

const RECEIPT_SOURCE = `// The receipt of one order.
import { twice, wrong } from './orders/double.js';
import { receiptOptions } from './orders/receipt.js';
import { orderTotal } from './orders/total.js';

const formatter = new Intl.NumberFormat('en-US', receiptOptions);
const total = orderTotal([{ price: 2, quantity: 3 }], 'EUR');

/**
The receipt line of the sample order.
*/
export const receipt = formatter.format(total.amount);

/**
Twice the sample result.
*/
export const doubled = twice(wrong);
`;

const TYPESCRIPT_SANDBOX = {
    configurations: ['typescript'],
    without: ['markdown'],

    json: {
        'tsconfig.json': {
            compilerOptions: { ...STRICT_COMPILER_OPTIONS, allowJs: true },
            include: ['src', 'types'],
        },
        'jsconfig.json': {
            compilerOptions: { ...STRICT_COMPILER_OPTIONS, checkJs: true, noEmit: true },
            include: ['src/**/*.js'],
        },
    },
    files: {
        'package.json': TYPESCRIPT_PACKAGE,
        '.gitignore': 'node_modules/\n',
        'README.md': README,
        LICENSE,
        'types/orders.ts': `// Type aliases of the orders module.

/**
One line of an order.
*/
export type OrderLine = { price: number; quantity: number };
`,
        'types/totals.ts': `// Type aliases of the totals.

/**
A total with its currency.
*/
export type Total = { amount: number; currency: string };
`,
        'src/orders/total.ts': `// The total of an order.
import type { OrderLine } from '#types/orders.js';
import type { Total } from '#types/totals.js';

/**
Adds up the lines of an order.

@param lines the purchased quantities and unit prices
@param currency the currency of every line
@returns the total price
*/
export function orderTotal(lines: OrderLine[], currency: string): Total {
    let amount = 0;
    for (const line of lines) amount += line.price * line.quantity;
    return { amount, currency };
}
`,
        'src/orders/receipt.ts': `// The receipt currency format.

/**
Formats the euro amounts on receipts.
*/
export const receiptOptions = { style: 'currency', currency: 'EUR' } as const;
`,
        'src/orders/double.js': DOUBLE_SOURCE,
        'src/main.ts': RECEIPT_SOURCE,
    },
} as const;

const ARCHITECTURE_SETTINGS = `
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

const UNUSED_SOURCE = `// Nothing imports this.

/**
A value nobody reads.
*/
export const unused = 1;
`;

const TYPESCRIPT_CASES = [
    {
        check: 'javascript/eslint',
        files: {
            'src/orders/back.ts': `// An order module that reaches back into the entry.
import { receipt } from '#entry';

/**
The entry receipt with the order label, as the order screen shows it.
*/
export const receiptLabel = \`Order: \${receipt}\`;
`,
        },
        expected: { file: 'src/orders/back.ts', rule: 'boundaries/dependencies', line: 2 },
    },
    {
        check: 'javascript/eslint',
        apply: true,
        settings: '[[import_rule]]\nname = "late"\npaths = ["src/orders/late.ts"]\n',
        files: {
            'src/orders/late.ts': `// An order module that a later import rule also names.
import { receipt } from '#entry';

/**
The entry receipt with the late label.
*/
export const lateLabel = \`Late: \${receipt}\`;
`,
        },
        expected: { file: 'src/orders/late.ts', rule: 'boundaries/dependencies', line: 2 },
    },
    {
        check: 'javascript/knip',
        files: {
            'src/orders/unused.ts': UNUSED_SOURCE,
        },
        expected: { file: 'src/orders/unused.ts', message: 'Unused file: src/orders/unused.ts' },
        corrected: {
            files: {
                'src/orders/unused.ts': UNUSED_SOURCE,
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

const SAMPLE_CHECKS = [
    'format/prettier',
    'javascript/biome',
    'javascript/eslint',
    'javascript/import-cycles',
    'javascript/knip',
    'javascript/tsc',
    'typescript/tsc',
    'typescript/tsconfig',
] as const;

describe('after the shared TypeScript sandbox installs its tools', () => {
    const installedSandbox = shareInstalledSandbox(TYPESCRIPT_SANDBOX);

    beforeAll(async () => {
        await appendFile(join(installedSandbox().root, 'gspot.toml'), ARCHITECTURE_SETTINGS);
        await applyGeneratedFiles(installedSandbox().root);
    });

    test.each([...TYPESCRIPT_CASES])('$check reports $expected.file and passes after the fix', async (sample) => {
        await assertCheckSample(installedSandbox(), sample);
    });

    test('the sample TypeScript repository passes every check that init selects for it', async () => {
        const { root } = installedSandbox();
        const checked = parseCheckReport(await spawnGspot(root, ['check', '--json']));
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        const passed = new Set(
            checked.report.checks.filter(({ status }) => status === 'passed').map(({ check }) => check),
        );
        expect(SAMPLE_CHECKS.filter((check) => !passed.has(check))).toStrictEqual([]);
    });
});
