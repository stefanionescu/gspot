// Planted repository for the typescript preset and what it brings: every check fires on its planted defect.

import { join } from 'node:path';
// The sandbox links this repository's node_modules, so ESLint, its plugins, tsc, knip and Prettier run offline.
import { fileURLToPath } from 'node:url';
import { createFileTree, testdir } from 'testdirs';
import type { RunReport } from '#cli/output/report-types.ts';
import { describe, expect, test } from 'bun:test';
import type { FindingCase } from '#tests/support/cli/planted.ts';
import { symlinkSync, writeFileSync, readdirSync, mkdirSync, chmodSync, statSync } from 'node:fs';
import {
    installPrivateTools,
    commitAll,
    PLANTED_TIMEOUT_MS,
    run,
    runPlanted,
    toolsPath,
} from '#tests/support/cli/planted.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

test(
    'generated TypeScript configuration reports an interface once through the pinned replacement rule',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nlevel = "all"\npresets = ["typescript"]\n',
            'package.json': '{"name":"interface-check","private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
            'src/order.ts': 'export interface Order { total: number }\n',
        });
        symlinkSync(join(root, 'node_modules'), join(sandbox.path, 'node_modules'), 'dir');
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
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

test.each([
    ['star exports', 'export * from "./first.js";\nexport * from "./second.js";\n'],
    ['a local declaration', 'export { shared } from "./first.js";\nexport const shared = 3;\n'],
    ['nested star exports', 'export * from "./bridge/index.js";\nexport { shared } from "./first.js";\n'],
])(
    'generated index-only policy reports duplicate names from %s',
    async (_scenario, barrel) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nlevel = "all"\npresets = ["typescript"]\n[structure]\nreexports = "index-only"\n',
            'package.json': '{"name":"barrel-check","private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
            'src/first.ts': 'export const shared = 1;\n',
            'src/second.ts': 'export const shared = 2;\n',
            'src/index.ts': barrel,
            'src/bridge/index.ts': 'export * from "../first.js";\n',
            'src/forward.ts': 'export { shared } from "./first.ts";\n',
        });
        symlinkSync(join(root, 'node_modules'), join(sandbox.path, 'node_modules'), 'dir');
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await installPrivateTools(sandbox.path);
        const outcome = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache', '--json']);
        expect(outcome.code, outcome.stdout + outcome.stderr).toBe(1);
        const report = JSON.parse(outcome.stdout) as RunReport;
        const findings = report.checks.flatMap((check) => check.findings);
        expect(findings.filter((finding) => finding.rule === 'gspot/no-reexports')).toMatchObject([
            { check: 'typescript/eslint', file: 'src/forward.ts', line: 1, column: 1 },
        ]);
        expect(findings.filter((finding) => finding.rule === 'import-x/export')).toMatchObject([
            { check: 'typescript/eslint', file: 'src/index.ts', line: 1 },
            { check: 'typescript/eslint', file: 'src/index.ts', line: 2 },
        ]);
        writeFileSync(
            join(sandbox.path, 'src/index.ts'),
            'export * from "./first.js";\nexport { shared as second } from "./second.js";\n',
        );
        writeFileSync(join(sandbox.path, 'src/forward.ts'), 'export const shared = 1;\n');
        const corrected = await run(sandbox.path, ['check', '--only', 'typescript/eslint', '--no-cache', '--json']);
        const correctedReport = JSON.parse(corrected.stdout) as RunReport;
        expect(correctedReport.checks[0]?.status).not.toBe('error');
        expect(
            correctedReport.checks
                .flatMap((check) => check.findings)
                .filter((finding) => finding.rule === 'gspot/no-reexports' || finding.rule === 'import-x/export'),
        ).toEqual([]);
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
    let amount = 0;
    for (const line of lines) amount += line.price * line.quantity;
    return { amount, currency };
}
`;
const RECEIPT = `// The receipt currency format.

/** Formats the euro amounts on receipts. */
export const receiptOptions = { style: 'currency', currency: 'EUR' } as const;
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
            message: `error: \`${MISSPELLED}\` should be \`The\``,
        },
    },
    {
        check: 'integrity/config-purity',
        files: {
            'config/limits.ts': '// The limits.\n\n/** The most lines. */\nexport const MAX_LINES = 10;\n',
            'config/logic.ts':
                '// Logic where literals belong.\n\n/**\n * Doubles a value.\n * @param value the value\n * @returns twice the value\n */\nexport function twice(value: number): number {\n    return value * 2;\n}\n',
        },
        policy: '[architecture]\nroles = { config = "config" }\n',
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

describe('the typescript preset', () => {
    test(
        'every check passes on a clean project and fires on its planted defect',
        async () => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'package.json': PACKAGE,
                'tsconfig.json':
                    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src", "types"]\n}\n',
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
            await installPrivateTools(sandbox.path);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const whole = await run(sandbox.path, ['check', '--no-cache'], environment);
            expect(whole.code, whole.stdout).toBe(0);
            for (const planted of CASES) {
                const outcome = await runPlanted(sandbox.path, planted, environment);
                expect(outcome.code, `${planted.check}: ${outcome.stdout}`).toBe(1);
                const report = JSON.parse(await Bun.file(join(sandbox.path, '.gspot/report.json')).text()) as RunReport;
                const result = report.checks.find((entry) => entry.check === planted.check);
                expect(result?.status, outcome.stdout).toBe('fail');
                const finding = result?.findings.find(
                    (entry) => entry.file === planted.expected.file && entry.rule === planted.expected.rule,
                );
                expect(finding).toMatchObject({ check: planted.check, ...planted.expected });
            }
            // typos forgets its exclude list for a file named on the command line unless it is told to keep it.
            const excluded = await runPlanted(
                sandbox.path,
                {
                    check: 'spelling/typos',
                    files: { 'assets/mark.svg': `<svg><title>${MISSPELLED}</title></svg>\n` },
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
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
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
            await installPrivateTools(sandbox.path);
            const selected = await run(sandbox.path, ['set', 'level', 'all'], environment);
            expect(selected.code, selected.stdout + selected.stderr).toBe(0);
            const outcome = await runPlanted(
                sandbox.path,
                {
                    check: 'javascript/eslint',
                    files: { 'src/paused.js': clean.replace('    return', () => '    debugger;\n    return') },
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
level = "all"
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
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                'gspot.toml': scope === '' ? POLICY : POLICY + '\n[[scope]]\npath = "api"\npresets = ["typescript"]\n',
                '.gitignore': 'node_modules/\n.gspot/\n',
                'tsconfig.json': scope === '' ? solution : '{"files":["root.ts"],"compilerOptions":{"types":[]}}',
                'root.ts': 'export const root = 1;',
                [`${scope}tsconfig.json`]: solution,
                [`${scope}orders/tsconfig.json`]: PROJECT,
                [`${scope}users/tsconfig.json`]: PROJECT.replace(
                    '"include"',
                    '"references":[{"path":"../orders"}],"include"',
                ),
                [`${scope}orders/order.ts`]: 'export const total: number = "wrong";',
                [`${scope}users/user.ts`]:
                    'import { total } from "../orders/order.js"; export const active: boolean = total;',
            });
            mkdirSync(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
            symlinkSync(join(root, 'node_modules/typescript'), join(sandbox.path, 'node_modules/typescript'), 'dir');
            symlinkSync('../typescript/bin/tsc', join(sandbox.path, 'node_modules/.bin/tsc'));
            commitAll(sandbox.path);
            const applied = await run(sandbox.path, ['apply']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
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
            writeFileSync(
                join(sandbox.path, `${scope}users/user.ts`),
                'import { total } from "../orders/order.js"; export const active: boolean = total > 0;',
            );
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

test.each(['', 'apps/web'])(
    'Vite initialization in %s preserves authored compiler settings while each level checks its diagnostic flags',
    async (scope) => {
        await using sandbox = await testdir();
        const prefix = scope === '' ? '' : `${scope}/`;
        const authored = `{
    // The application owns its build and module settings.
    "compilerOptions": {
        "strict": false,
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "types": [],
        "incremental": true,
        "tsBuildInfoFile": ${JSON.stringify(join(sandbox.path, scope, 'build/cache.tsbuildinfo'))}
    },
    "include": ["src"],
}\n`;
        await createFileTree(sandbox.path, {
            'package.json':
                '{"name":"preserved-vite","private":true,"type":"module","devDependencies":{"vite":"8.3.0"}}',
            '.gitignore': 'node_modules/\n.gspot/\n',
            [`${prefix}tsconfig.json`]: authored,
            [`${prefix}src/main.ts`]: 'export function echo(value) { return value; }\n',
            [`${prefix}build/cache.tsbuildinfo`]: 'authored metadata\n',
        });
        mkdirSync(join(sandbox.path, 'node_modules/.bin'), { recursive: true });
        symlinkSync(join(root, 'node_modules/typescript'), join(sandbox.path, 'node_modules/typescript'), 'dir');
        symlinkSync('../typescript/bin/tsc', join(sandbox.path, 'node_modules/.bin/tsc'));
        chmodSync(join(sandbox.path, scope, 'tsconfig.json'), 0o640);
        const initialized = await run(sandbox.path, [
            'init',
            '--yes',
            '--presets',
            scope === '' ? 'typescript' : 'javascript',
            ...(scope === '' ? [] : ['--scope', `${scope}=typescript`]),
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-rules',
            '--no-install',
        ]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, scope, 'tsconfig.json')).text()).toBe(authored);
        expect(statSync(join(sandbox.path, scope, 'tsconfig.json')).mode & 0o777).toBe(0o640);
        const failed = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--no-cache', '--json']);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks.flatMap((check) => check.findings)).toMatchObject([
            { check: 'typescript/tsc', file: `${prefix}src/main.ts`, rule: 'TS7006', line: 1, column: 22 },
        ]);
        writeFileSync(
            join(sandbox.path, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = [1][0];\n',
        );
        const recommended = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--no-cache', '--json']);
        expect(recommended.code, recommended.stdout + recommended.stderr).toBe(0);
        const selected = await run(sandbox.path, ['set', 'level', 'all']);
        expect(selected.code, selected.stdout + selected.stderr).toBe(0);
        const strict = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--no-cache', '--json']);
        expect(strict.code, strict.stdout + strict.stderr).toBe(1);
        const strictReport = JSON.parse(strict.stdout) as RunReport;
        expect(strictReport.checks.flatMap((check) => check.findings)).toMatchObject([
            { check: 'typescript/tsc', file: `${prefix}src/main.ts`, rule: 'TS2322', line: 2, column: 14 },
        ]);
        writeFileSync(
            join(sandbox.path, scope, 'src/main.ts'),
            'export function echo(value: string) { return value; }\nexport const first: number = [1][0] ?? 0;\n',
        );
        const corrected = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--no-cache', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, scope, 'tsconfig.json')).text()).toBe(authored);
        expect(statSync(join(sandbox.path, scope, 'tsconfig.json')).mode & 0o777).toBe(0o640);
        expect(await Bun.file(join(sandbox.path, scope, 'build/cache.tsbuildinfo')).text()).toBe('authored metadata\n');
    },
    PLANTED_TIMEOUT_MS,
);

test.each(['absolute', 'symlink'])(
    'TypeScript confines %s build output to its disposable project',
    async (kind) => {
        await using sandbox = await testdir();
        await using outside = await testdir();
        await createFileTree(outside.path, { 'value.js': 'authored output\n', '.bin': {} });
        symlinkSync(join(root, 'node_modules/typescript'), join(outside.path, 'typescript'), 'dir');
        symlinkSync('../typescript/bin/tsc', join(outside.path, '.bin/tsc'));
        const project = (outDir: string): string =>
            JSON.stringify({
                compilerOptions: { composite: true, types: [], outDir },
                include: ['*.ts'],
            });
        await createFileTree(sandbox.path, {
            'gspot.toml': POLICY,
            '.gitignore': 'node_modules\n.gspot\n',
            'tsconfig.json': '{"files":[],"references":[{"path":"./app"}]}',
            'app/tsconfig.json': project(kind === 'absolute' ? outside.path : '../node_modules'),
            'app/value.ts': 'export const count = 1;\n',
        });
        symlinkSync(
            kind === 'symlink' ? outside.path : join(root, 'node_modules'),
            join(sandbox.path, 'node_modules'),
            'dir',
        );
        commitAll(sandbox.path);
        const applied = await run(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const failed = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--no-cache', '--json']);
        expect(failed.code, failed.stdout + failed.stderr).toBe(kind === 'absolute' ? 2 : 0);
        if (kind === 'absolute') expect(failed.stdout + failed.stderr).toContain('Unsafe lifecycle path');
        expect(await Bun.file(join(outside.path, 'value.js')).text()).toBe('authored output\n');
        writeFileSync(join(sandbox.path, 'app/tsconfig.json'), project('./dist'));
        const corrected = await run(sandbox.path, ['check', '--only', 'typescript/tsc', '--no-cache', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(await Bun.file(join(outside.path, 'value.js')).text()).toBe('authored output\n');
        expect(readdirSync(join(sandbox.path, 'app')).sort()).toEqual(['tsconfig.json', 'value.ts']);
    },
    PLANTED_TIMEOUT_MS,
);
