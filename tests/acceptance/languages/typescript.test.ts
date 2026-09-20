// Planted repository for the typescript preset and what it brings: every check fires on its planted defect.

import { join } from 'node:path';
// The sandbox links this repository's node_modules, so ESLint, its plugins, tsc, knip and Prettier run offline.
import { fileURLToPath } from 'node:url';
import { createSandbox } from '@gspot/testing';
import type { RunReport } from '#types/report.ts';
import { describe, expect, test } from 'bun:test';
import type { PlantedCase } from '#tests/types/acceptance.ts';
import { symlinkSync, writeFileSync, readdirSync } from 'node:fs';
import { commitAll, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

test(
    'generated TypeScript configuration reports an interface once through the pinned replacement rule',
    async () => {
        await using sandbox = await createSandbox({
            'gspot.toml': 'version = 1\npresets = ["typescript"]\n',
            'package.json': '{"name":"interface-check","private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
            'src/order.ts': 'export interface Order { total: number }\n',
        });
        symlinkSync(join(root, 'node_modules'), join(sandbox.path, 'node_modules'), 'dir');
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const outcome = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache', '--json']);
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
        const report = JSON.parse(outcome.stdout) as RunReport;
        const findings = report.checks
            .flatMap((check) => check.findings)
            .filter(
                (finding) =>
                    finding.rule === '@typescript-eslint/consistent-type-definitions' ||
                    finding.rule === 'gspot/types-placement',
            );
        expect(findings.map(({ check, file, line, column, rule }) => ({ check, file, line, column, rule }))).toEqual([
            {
                check: 'typescript/eslint',
                file: 'src/order.ts',
                line: 1,
                column: 18,
                rule: '@typescript-eslint/consistent-type-definitions',
            },
        ]);
    },
    PLANTED_TIMEOUT_MS,
);

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
        check: 'typescript/eslint',
        files: {
            'src/orders/forward.ts':
                '// A second name for the receipt function.\nimport { receiptLine } from "./receipt.js";\nimport type { Total } from "#types/totals.js";\n\n/**\n * Formats a receipt.\n * @param total the total\n * @returns the receipt line\n */\nexport const forward = (total: Total): string => receiptLine(total);\n',
        },
        expected: 'gspot/no-call-through',
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
            await using sandbox = await createSandbox({
                'package.json': PACKAGE,
                '.gitignore': 'node_modules/\n',
                'types/orders.ts': ORDERS_TYPES,
                'types/totals.ts': TOTALS_TYPES,
                'src/orders/total.ts': TOTAL,
                'src/orders/receipt.ts': RECEIPT,
                'src/main.ts': MAIN,
            });
            symlinkSync(join(root, 'node_modules'), join(sandbox.path, 'node_modules'), 'dir');
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ast-grep', 'ec', 'typos']) };
            await run(
                sandbox.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'typescript',
                    '--no-runner',
                    '--no-ci',
                    '--no-hooks',
                    '--no-rules',
                    '--no-install',
                ],
                environment,
            );
            const whole = await run(sandbox.path, ['check', '--no-cache'], environment);
            expect(whole.code, whole.stdout).toBe(0);
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.check).toContain(planted.expected);
            }
            // typos forgets its exclude list for a file named on the command line unless it is told to keep it.
            const excluded = await runPlanted(
                sandbox.path,
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
            await using sandbox = await createSandbox({
                'package.json': PACKAGE,
                '.gitignore': 'node_modules/\n',
                'src/main.js': clean,
                'src/index.js': "// The entry point.\nexport { twice } from './main.js';\n",
            });
            symlinkSync(join(root, 'node_modules'), join(sandbox.path, 'node_modules'), 'dir');
            commitAll(sandbox.path);
            const environment = { PATH: toolsPath(['ast-grep', 'ec', 'typos']) };
            await run(
                sandbox.path,
                [
                    'init',
                    '--yes',
                    '--presets',
                    'javascript',
                    '--no-runner',
                    '--no-ci',
                    '--no-hooks',
                    '--no-rules',
                    '--no-install',
                ],
                environment,
            );
            const outcome = await runPlanted(
                sandbox.path,
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

const POLICY = `version = 1
presets = ["typescript"]
[rules]
install = false
`;
const PROJECT = '{"compilerOptions":{"composite":true,"strict":true,"types":[],"target":"ES2020"},"include":["*.ts"]}';

for (const scope of ['', 'api/']) {
    test(
        `TypeScript solution ${scope || 'root'} checks both projects without writing build output`,
        async () => {
            const solution =
                '{// The solution has no sources.\n"files":[],"references":[{"path":"./orders"},{"path":"./users"}],}';
            await using sandbox = await createSandbox({
                'gspot.toml': scope === '' ? POLICY : POLICY + '\n[[scope]]\npath = "api"\npresets = ["typescript"]\n',
                '.gitignore': 'node_modules/\n.gspot/\n',
                'tsconfig.json': scope === '' ? solution : '{"files":["root.ts"],"compilerOptions":{"types":[]}}',
                'root.ts': 'export const root = 1;',
                [`${scope}tsconfig.json`]: solution,
                [`${scope}orders/tsconfig.json`]: PROJECT,
                [`${scope}users/tsconfig.json`]: PROJECT,
                [`${scope}orders/order.ts`]: 'export const total: number = "wrong";',
                [`${scope}users/user.ts`]: 'export const active: boolean = 42;',
            });
            symlinkSync(join(root, 'node_modules'), join(sandbox.path, 'node_modules'), 'dir');
            commitAll(sandbox.path);
            const failed = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--no-cache', '--json']);
            const report = JSON.parse(failed.stdout) as RunReport;
            expect(failed.code, failed.stdout + failed.stderr).toBe(1);
            const findings = report.checks.flatMap((check) => check.findings);
            expect(
                findings
                    .filter((finding) => finding.rule === 'TS2322')
                    .map((finding) => finding.file)
                    .toSorted((left, right) => left.localeCompare(right)),
            ).toEqual([`${scope}orders/order.ts`, `${scope}users/user.ts`]);
            writeFileSync(join(sandbox.path, `${scope}orders/order.ts`), 'export const total: number = 3;');
            writeFileSync(join(sandbox.path, `${scope}users/user.ts`), 'export const active: boolean = true;');
            const clean = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--no-cache', '--json']);
            expect(clean.code, clean.stdout + clean.stderr).toBe(0);
            const output = ['orders', 'users'].flatMap((folder) =>
                readdirSync(join(sandbox.path, scope, folder), { recursive: true }).map(String),
            );
            expect(output.filter((path) => /\.(?:tsbuildinfo|js|d\.ts)$/u.test(path))).toEqual([]);
        },
        PLANTED_TIMEOUT_MS,
    );
}
