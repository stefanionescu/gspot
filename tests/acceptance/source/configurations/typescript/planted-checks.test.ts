// Source CLI journeys: every check of the typescript configuration reports its planted defect and accepts the correction.
import { join } from 'node:path';
import { symlinkSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { commitAll } from '#tests/support/cli/git.ts';
import { reportSchema } from '#cli/execution/report.ts';
import { runPlanted } from '#tests/support/cli/planted.ts';
import { containing } from '#tests/support/expectations.ts';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { INSTALLED_MODULES } from '#tests/support/cli/modules.ts';
import { TYPESCRIPT_PACKAGE } from '#tests/support/cli/typescript.ts';
import { PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';
import { installPrivateTools, toolsPath } from '#tests/support/cli/tools.ts';

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
    let amount = 0;
    for (const line of lines) amount += line.price * line.quantity;
    return { amount, currency };
}
`;
const RECEIPT = `// The receipt currency format.

/** Formats the euro amounts on receipts. */
export const receiptOptions: Intl.NumberFormatOptions = { style: 'currency', currency: 'EUR' };
`;
const MAIN = `// The receipt of one order.
import { orderTotal } from './orders/total.js';
import { receiptOptions } from './orders/receipt.js';

const formatter = new Intl.NumberFormat('en-US', receiptOptions);
const total = orderTotal([{ price: 2, quantity: 3 }], 'EUR');

/** The receipt line of the sample order. */
export const receipt = formatter.format(total.amount);
`;

// Built from two halves, so the spelling fixer of this repository never corrects the planted typo.
const MISSPELLED = ['Te', 'h'].join('');

const CASES: FindingCase[] = [
    {
        check: 'typescript/tsc',
        files: {
            'src/orders/wrong.ts':
                "// A wrong type.\n\n/** A count that is not a number. */\nexport const count: number = 'three';\n",
        },
        expected: { file: 'src/orders/wrong.ts', rule: 'TS2322', line: 4, column: 14 },
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
        check: 'typescript/eslint',
        files: {
            'src/orders/forward.ts':
                '// A second name for the receipt function.\nimport { receiptOptions } from "./receipt.js";\nimport type { Total } from "#types/totals.js";\n\n/**\n * Formats a receipt.\n * @param total the total\n * @returns the receipt line\n */\nexport const forward = (total: Total): string => new Intl.NumberFormat("en-US", receiptOptions).format(total.amount);\n',
        },
        expected: { file: 'src/orders/forward.ts', rule: 'gspot/no-trivial-functions', line: 10, column: 24 },
    },
    {
        check: 'javascript/knip',
        files: {
            'src/orders/unused.ts':
                '// Nothing imports this.\n\n/** A value nobody reads. */\nexport const unused = 1;\n',
        },
        expected: { file: 'src/orders/unused.ts', message: 'src/orders/unused.ts' },
    },
    {
        check: 'naming/identifiers',
        files: {
            'src/orders/names.ts':
                '// A name with a banned word.\n\n/** A helper value. */\nexport const orderHelper = 1;\n',
        },
        expected: { file: 'src/orders/names.ts', rule: 'banned-term', line: 4, column: 14 },
    },
    {
        check: 'naming/paths',
        files: {
            'src/orders/order-utils.ts':
                '// A file name with a banned word.\n\n/** A value. */\nexport const orderCount = 1;\n',
        },
        expected: { file: 'src/orders/order-utils.ts', rule: 'banned-term', line: 1, column: 1 },
    },
    {
        check: 'naming/policy-schema',
        files: {},
        policy: '[naming]\nallowed = [{name = "neverUsedName", reason = "A name nothing in this repository carries."}]\n',
        expected: {
            file: 'gspot.toml',
            message: 'naming.allowed names "neverUsedName", which no identifier in this scope carries.',
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
        files: {
            'src/orders/typo.ts': `// ${MISSPELLED} order of things.\n\n/** A value. */\nexport const orderCount = 1;\n`,
        },
        expected: {
            file: 'src/orders/typo.ts',
            line: 1,
            column: 4,
            message: `\`${MISSPELLED}\` should be \`The\``,
        },
    },
    {
        check: 'integrity/config-purity',
        files: {
            'config/limits.ts': '// The limits.\n\n/** The most lines. */\nexport const MAX_LINES = 10;\n',
            'config/logic.ts':
                '// Logic where literals belong.\n\n/**\n * Doubles a value.\n * @param value the value\n * @returns twice the value\n */\nexport function twice(value: number): number {\n    return value * 2;\n}\n',
        },
        // init already wrote the architecture table, so the role joins it as a subtable.
        policy: '[architecture.roles]\nconfig = "config"\n',
        expected: { file: 'config/logic.ts', rule: 'logic-in-config', line: 8 },
    },
    {
        check: 'javascript/checkjs',
        files: {
            'src/orders/legacy.js':
                '// A plain JavaScript file with a wrong call.\n\n/**\n * Doubles a number.\n * @param {number} value the value\n * @returns {number} twice the value\n */\nexport function twice(value) {\n    return value * 2;\n}\n\n/** A call with a string. */\nexport const wrong = twice("x");\n',
        },
        expected: { file: 'src/orders/legacy.js', rule: 'TS2345', line: 13, column: 28 },
    },
    {
        check: 'integrity/tsconfig-options',
        files: {
            'tsconfig.json': '{\n    "compilerOptions": { "strict": false }\n}\n',
        },
        expected: { file: 'tsconfig.json', rule: 'strict' },
    },
];

describe('the typescript configuration', () => {
    test.each(CASES)(
        '$check reports its defect in $expected.file and accepts a corrected input',
        async (planted) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'package.json': TYPESCRIPT_PACKAGE,
                'tsconfig.json':
                    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src", "types"]\n}\n',
                '.gitignore': 'node_modules/\n',
                'types/orders.ts': ORDERS_TYPES,
                'types/totals.ts': TOTALS_TYPES,
                'src/orders/total.ts': TOTAL,
                'src/orders/receipt.ts': RECEIPT,
                'src/main.ts': MAIN,
            });
            symlinkSync(INSTALLED_MODULES, join(sandbox.path, 'node_modules'), 'dir');
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ast-grep', 'ec', 'typos']) };
            const initialized = await run(
                sandbox.path,
                [
                    'init',
                    '--yes',
                    '--configurations',
                    'typescript',
                    '--no-runner',
                    '--no-ci',
                    '--no-hooks',
                    '--no-rules',
                    '--no-install',
                ],
                environment,
            );
            expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
            await installPrivateTools(sandbox.path);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const whole = await run(sandbox.path, ['check', '--no-cache'], environment);
            expect(whole.code, whole.stdout).toBe(0);
            const outcome = await runPlanted(sandbox.path, planted, environment);
            expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
            const failed = reportSchema.parse(await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json());
            expect(failed.checks).toMatchObject([{ check: planted.check, status: 'fail' }]);
            expect(failed.checks[0]!.findings).toContainEqual(containing(planted.expected));
            const value =
                '// A value owned by this module.\n\n/** The number of orders. */\nexport const orderCount = 1;\n';
            const files: Record<string, string> = {};
            switch (planted.check) {
                case 'typescript/tsc': {
                    files['src/orders/wrong.ts'] = planted.files['src/orders/wrong.ts']!.replace("'three'", '3');
                    break;
                }
                case 'typescript/eslint':
                case 'naming/identifiers':
                case 'formatting/prettier':
                case 'formatting/editorconfig-checker': {
                    files[planted.expected.file] = value;
                    break;
                }
                case 'javascript/knip': {
                    files['src/orders/unused.ts'] = planted.files['src/orders/unused.ts']!;
                    files['src/main.ts'] =
                        MAIN + "\nimport { unused } from './orders/unused.js';\nexport const additional = unused;\n";
                    break;
                }
                case 'naming/paths': {
                    files['src/orders/count.ts'] = value;
                    break;
                }
                case 'naming/policy-schema': {
                    files['src/orders/allowed.ts'] = value.replace('orderCount', 'neverUsedName');
                    break;
                }
                case 'spelling/typos': {
                    files[planted.expected.file] = planted.files[planted.expected.file]!.replace(MISSPELLED, 'The');
                    break;
                }
                case 'integrity/config-purity': {
                    files['config/limits.ts'] = planted.files['config/limits.ts']!;
                    files['config/logic.ts'] = value;
                    break;
                }
                case 'javascript/checkjs': {
                    files['src/orders/legacy.js'] = planted.files['src/orders/legacy.js']!.replace(
                        'twice("x")',
                        'twice(3)',
                    );
                    break;
                }
            }
            const corrected = await runPlanted(sandbox.path, { ...planted, files }, environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const accepted = reportSchema.parse(
                await Bun.file(join(sandbox.path, '.gspot/reports/report.json')).json(),
            );
            expect(accepted.checks).toMatchObject([{ check: planted.check, status: 'ok', findings: [] }]);
            // typos forgets its exclude list for a file named on the command line unless it is told to keep it.
            const excluded =
                planted.check === 'spelling/typos'
                    ? await runPlanted(
                          sandbox.path,
                          {
                              check: 'spelling/typos',
                              files: { 'assets/mark.svg': `<svg><title>${MISSPELLED}</title></svg>\n` },
                          },
                          environment,
                      )
                    : undefined;
            expect(excluded?.code ?? 0, excluded?.stdout).toBe(0);
        },
        PLANTED_TIMEOUT_MS * 5,
    );
});
