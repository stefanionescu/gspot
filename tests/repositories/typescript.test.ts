// Planted repository for the typescript preset and what it brings: every check fires on its planted defect.

import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
// The fixture links this repository's node_modules, so ESLint, its plugins, tsc, knip and Prettier run offline.
import { fileURLToPath } from 'node:url';
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));

const PACKAGE = `{
    "name": "planted",
    "version": "1.0.0",
    "private": true,
    "type": "module",
    "imports": {
        "#types/*": "./types/*"
    },
    "packageManager": "bun@1.3.11",
    "engines": {
        "node": ">=22.0.0"
    }
}
`;
const ORDERS_TYPES =
    '// Type aliases of the orders module.\n\n/** One line of an order. */\nexport type OrderLine = { price: number; quantity: number };\n';
const TOTALS_TYPES =
    '// Type aliases of the totals.\n\n/** A total with its currency. */\nexport type Total = { amount: number; currency: string };\n';
const TOTAL = `// The total of an order.
import type { Total } from '#types/totals.js';
import type { OrderLine } from '#types/orders.js';

/**
 * Adds up the lines of an order.
 * @param lines the lines
 * @param currency the currency of every line
 * @returns the total price
 */
export function orderTotal(lines: OrderLine[], currency: string): Total {
    const amount = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    return { amount, currency };
}
`;
const RECEIPT = `// The receipt line of a total.
import type { Total } from '#types/totals.js';

/**
 * Formats a total for a receipt.
 * @param total the total
 * @returns the line
 */
export function receiptLine(total: Total): string {
    return \`\${total.amount.toFixed(2)} \${total.currency}\`;
}
`;
const MAIN = `// The receipt of one order.
import { orderTotal } from './orders/total.js';
import { receiptLine } from './orders/receipt.js';

/** The receipt line of the sample order. */
export const receipt = receiptLine(orderTotal([{ price: 2, quantity: 3 }], 'EUR'));
`;

// Built from two halves, so the spelling fixer of this repository never corrects the planted typo.
const MISSPELLED = ['Te', 'h'].join('');

const CASES: PlantedCase[] = [
    {
        check: 'typescript/tsc',
        files: {
            'src/orders/wrong.ts':
                "// A wrong type.\n\n/** A count that is not a number. */\nexport const count: number = 'three';\n",
        },
        expected: 'TS2322',
    },
    {
        check: 'typescript/eslint',
        files: {
            'src/orders/paused.ts':
                '// A debugger statement left behind.\n\n/**\n * Doubles a value.\n * @param value the value\n * @returns twice the value\n */\nexport function twice(value: number): number {\n    debugger;\n    return value * 2;\n}\n',
        },
        expected: 'no-debugger',
    },
    {
        check: 'javascript/knip',
        files: {
            'src/orders/unused.ts':
                '// Nothing imports this.\n\n/** A value nobody reads. */\nexport const unused = 1;\n',
        },
        expected: 'src/orders/unused.ts',
    },
    {
        check: 'naming/identifiers',
        files: {
            'src/orders/names.ts':
                '// A name with a banned word.\n\n/** A helper value. */\nexport const orderHelper = 1;\n',
        },
        expected: '"helper" is banned',
    },
    {
        check: 'naming/paths',
        files: {
            'src/orders/order-utils.ts':
                '// A file name with a banned word.\n\n/** A value. */\nexport const orderCount = 1;\n',
        },
        expected: '"utils" is banned',
    },
    {
        check: 'naming/policy-schema',
        files: {},
        policy: '[naming]\nallowed = [{name = "neverUsedName", reason = "A name nothing in this repository carries."}]\n',
        expected: 'which no identifier in this scope carries',
    },
    {
        check: 'formatting/prettier',
        files: {
            'src/orders/ugly.ts': '// Badly formatted.\n\n/** A value. */\nexport const   ugly   =   [1,2,\n3];\n',
        },
        expected: 'not formatted the way Prettier formats it',
    },
    {
        check: 'formatting/editorconfig-checker',
        files: {
            'src/orders/trailing.ts':
                '// Trailing spaces after this comment.   \n\n/** A value. */\nexport const orderCount = 1;\n',
        },
        expected: 'src/orders/trailing.ts',
    },
    {
        check: 'spelling/typos',
        files: {
            'src/orders/typo.ts': `// ${MISSPELLED} order of things.\n\n/** A value. */\nexport const orderCount = 1;\n`,
        },
        expected: 'The',
    },
    {
        check: 'integrity/config-purity',
        files: {
            'config/limits.ts': '// The limits.\n\n/** The most lines. */\nexport const MAX_LINES = 10;\n',
            'config/logic.ts':
                '// Logic where literals belong.\n\n/**\n * Doubles a value.\n * @param value the value\n * @returns twice the value\n */\nexport function twice(value: number): number {\n    return value * 2;\n}\n',
        },
        policyEdit: ['types_directory = "types"', 'types_directory = "types"\nroles = { config = "config" }'],
        expected: 'a configuration module holds literals only',
    },
    {
        check: 'javascript/checkjs',
        files: {
            'src/orders/legacy.js':
                '// A plain JavaScript file with a wrong call.\n\n/**\n * Doubles a number.\n * @param {number} value the value\n * @returns {number} twice the value\n */\nexport function twice(value) {\n    return value * 2;\n}\n\n/** A call with a string. */\nexport const wrong = twice("x");\n',
        },
        expected: 'TS2345',
    },
    {
        check: 'integrity/tsconfig-options',
        files: {
            'tsconfig.json':
                '{\n    "extends": "./.gspot/tsconfig.base.json",\n    "compilerOptions": { "strict": false }\n}\n',
        },
        expected: 'strict',
    },
];

describe('the typescript preset', () => {
    test(
        'every check passes on a clean project and fires on its planted defect',
        async () => {
            await using fixture = await createFixture({
                'package.json': PACKAGE,
                '.gitignore': 'node_modules/\n',
                'types/orders.ts': ORDERS_TYPES,
                'types/totals.ts': TOTALS_TYPES,
                'src/orders/total.ts': TOTAL,
                'src/orders/receipt.ts': RECEIPT,
                'src/main.ts': MAIN,
            });
            symlinkSync(join(root, 'node_modules'), join(fixture.path, 'node_modules'), 'dir');
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['ast-grep', 'ec', 'typos']) };
            await run(
                fixture.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'typescript',
                    '--runner',
                    'none',
                    '--ci',
                    'none',
                    '--hooks',
                    'none',
                    '--no-rules',
                    '--no-install',
                ],
                environment,
            );
            const whole = await run(fixture.path, ['check', '--no-cache'], environment);
            expect(whole.code, whole.stdout).toBe(0);
            for (const planted of CASES) {
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
            // typos forgets its exclude list for a file named on the command line unless it is told to keep it.
            const excluded = await runPlanted(
                fixture.path,
                {
                    check: 'spelling/typos',
                    files: { 'assets/mark.svg': `<svg><title>${MISSPELLED}</title></svg>\n` },
                    expected: '',
                },
                environment,
            );
            expect(excluded.code, excluded.stdout).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 5,
    );

    test(
        'javascript/eslint lints a project that has no TypeScript',
        async () => {
            const clean =
                '// Doubles numbers.\n\n/**\n * Doubles a number.\n * @param {number} value the value\n * @returns {number} twice the value\n */\nexport function twice(value) {\n    return value * 2;\n}\n';
            await using fixture = await createFixture({
                'package.json': PACKAGE,
                '.gitignore': 'node_modules/\n',
                'src/main.js': clean,
                'src/index.js': "// The entry point.\nexport { twice } from './main.js';\n",
            });
            symlinkSync(join(root, 'node_modules'), join(fixture.path, 'node_modules'), 'dir');
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['ast-grep', 'ec', 'typos']) };
            await run(
                fixture.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'javascript',
                    '--runner',
                    'none',
                    '--ci',
                    'none',
                    '--hooks',
                    'none',
                    '--no-rules',
                    '--no-install',
                ],
                environment,
            );
            const outcome = await runPlanted(
                fixture.path,
                {
                    check: 'javascript/eslint',
                    files: { 'src/paused.js': clean.replace('    return', () => '    debugger;\n    return') },
                    expected: 'no-debugger',
                },
                environment,
            );
            expect(outcome.code, outcome.stdout).toBe(1);
            expect(outcome.stdout).toContain('no-debugger');
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
