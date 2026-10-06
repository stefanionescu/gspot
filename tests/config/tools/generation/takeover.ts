/** Native Stylelint discovery without an explicit configuration argument. */
export const STYLELINT_DISCOVERY = `
import stylelint from './.gspot/node_modules/stylelint/lib/index.mjs';
const result = await stylelint.lint({ files: [process.argv[1]], cwd: process.cwd() });
const findings = result.results.flatMap(({ warnings, parseErrors, invalidOptionWarnings }) => [
    ...warnings.map(({ rule, line, column, severity }) => ({ rule, line, column, severity })),
    ...parseErrors,
    ...invalidOptionWarnings,
]);
process.stdout.write(JSON.stringify(findings));
`;

/** Native ESLint discovery of the configuration file, without loading a TypeScript adapter. */
export const ESLINT_DISCOVERY = String.raw`
import { relative } from 'node:path';
import { ESLint } from './.gspot/node_modules/eslint/lib/api.js';
const eslint = new ESLint({ cwd: process.cwd() });
process.stdout.write(relative(process.cwd(), await eslint.findConfigFile(process.argv[1])).replaceAll('\\', '/'));
`;

/** Native Knip configurations that were absent from the takeover declarations. */
export const KNIP_TAKEOVERS = [
    { file: '.knip.jsonc', source: '{"entry":["main.js"],"project":["*.js"]}' },
    { file: 'knip.ts', source: 'export default { entry: ["main.js"], project: ["*.js"] };\n' },
    { file: 'knip.js', source: 'export default { entry: ["main.js"], project: ["*.js"] };\n' },
];
