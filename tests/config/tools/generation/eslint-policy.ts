export const COALESCING_SOURCE = `export function fallback(value) {
    const alternate = value || {};
    return alternate ?? {};
}
export const known = (value) => value ?? { known: true };
`;

export const COALESCING_CORRECTION = `export function fallback(value) {
    if (value === undefined) return;
    return value;
}
export const known = (value) => value ?? { known: true };
`;

export const COALESCING_SCRIPT = `import { ESLint } from 'eslint';
import { check, format } from 'prettier';
const { default: blocks } = await import('./.gspot/config/eslint.config.mjs');
const layoutNames = ['padding-line-between-statements', 'lines-between-class-members'];
const layout = blocks.flatMap(({ rules = {} }) => Object.entries(rules)
    .filter(([name, setting]) => layoutNames.includes(name) &&
        ![0, 'off'].includes(Array.isArray(setting) ? setting[0] : setting)).map(([name]) => name));
const eslint = new ESLint({ overrideConfigFile: '.gspot/config/eslint.config.mjs' });
const results = await eslint.lintFiles(['source.js']);
const source = 'export class Example{first(){return 1;}second(){return 2;}}';
process.stdout.write(JSON.stringify({ layout,
    findings: results.flatMap(({ messages }) => messages
        .filter(({ ruleId, fatal }) => ruleId === 'no-restricted-syntax' || fatal)
        .map(({ ruleId, line, column, severity }) => ({ ruleId, line, column, severity }))),
    formatting: [await check(source, { parser: 'babel' }),
        await check(await format(source, { parser: 'babel' }), { parser: 'babel' })],
}));
`;

export const TYPE_EXPORT_PROJECT = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"strict":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["index.ts","value.ts"]}\n',
    'value.ts': 'export type Shape = { name: string };\nexport const value: Shape = { name: "example" };\n',
    'index.ts': 'import { value, Shape } from "./value.js";\nexport { value, Shape };\n',
};

export const TYPE_EXPORT_SCRIPT = `import { ESLint } from 'eslint';
import { format } from 'prettier';
const selected = ['@typescript-eslint/consistent-type-imports', '@typescript-eslint/consistent-type-exports'];
const eslint = new ESLint({ overrideConfigFile: '.gspot/config/eslint.config.mjs',
    fix: ({ ruleId }) => selected.includes(ruleId), });
const results = await eslint.lintFiles(['index.ts']);
await ESLint.outputFixes(results);
const [{ output }] = results;
const { readFile } = await import('node:fs/promises');
process.stdout.write(JSON.stringify({
    source: await format(output ?? await readFile('index.ts', 'utf8'), { parser: 'typescript' }),
    findings: results.flatMap(({ messages }) => messages
        .filter(({ ruleId, fatal }) => selected.includes(ruleId) || fatal)),
}));
`;

export const TYPE_EXPORT_CORRECTION = `import type { Shape } from "./value.js";
import { value } from "./value.js";
export type { Shape };
export { value };
`;
