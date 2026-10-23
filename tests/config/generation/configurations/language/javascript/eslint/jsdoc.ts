import { findFileTarget } from '#tests/setup/cli/config-files.ts';

export const JSDOC_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["typed.ts"]}\n',
    'jsconfig.json':
        '{"compilerOptions":{"strict":true,"noEmit":true,"checkJs":true,"allowJs":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["missing.js","malformed.js","capitalized.js","undefined.js"]}\n',
    'missing.js': `/**
 * Measure the input.
 * @param value The input text.
 * @returns The input length.
 */
export function measure(value) { return value.length; }
`,
    'malformed.js': `/**
 * Measure the input.
 * @param {string[} value The input text.
 * @returns {number} The input length.
 */
export function measure(value) { return value.length; }
`,
    'capitalized.js': `/**
 * Measure the input.
 * @param {String} value The input text.
 * @returns {number} The input length.
 */
export function measure(value) { return value.length; }
`,
    'undefined.js': `/**
 * Measure the input.
 * @param {MissingType} value The input text.
 * @returns {number} The input length.
 */
export function measure(value) { return value.length; }
`,
    'typed.ts': `/**
 * Measure the input.
 * @param value The input text.
 * @returns The input length.
 */
export function measure(value: string): number { return value.length; }
`,
} as const;

export const CORRECTED_JSDOC = `/**
 * Measure the input.
 * @param {string} value The input text.
 * @returns {number} The input length.
 */
export function measure(value) { return value.length; }
`;

export const JSDOC_RULES = [
    'jsdoc/require-param-type',
    'jsdoc/require-returns-type',
    'jsdoc/valid-types',
    'jsdoc/check-types',
    'jsdoc/no-undefined-types',
] as const;

export const JSDOC_FINDINGS = [
    {
        file: 'missing.js',
        findings: [
            { ruleId: 'jsdoc/require-param-type', line: 3 },
            { ruleId: 'jsdoc/require-returns-type', line: 4 },
        ],
    },
    { file: 'malformed.js', findings: [{ ruleId: 'jsdoc/valid-types', line: 3 }] },
    { file: 'capitalized.js', findings: [{ ruleId: 'jsdoc/check-types', line: 3 }] },
    { file: 'undefined.js', findings: [{ ruleId: 'jsdoc/no-undefined-types', line: 3 }] },
    { file: 'typed.ts', findings: [] },
] as const;

export const TSC_ARGUMENTS = [
    'node',
    'node_modules/typescript/lib/tsc.js',
    '--project',
    findFileTarget('javascript', 'jsconfig.json'),
    '--pretty',
    'false',
] as const;

/** A parameter named root, and the root0 placeholder that JSDoc gives an unnamed object parameter. */
export const ROOT_PARAMETERS = `/**
 * Join a path to the folder.
 * @param root the folder to start from.
 * @param path the path inside it.
 * @returns both, joined with a slash.
 */
export function joinPath(root, path) { return \`\${root}/\${path}\`; }

/**
 * Read the name from the options.
 * @param root0 what to read from.
 * @param root0.name the value to give back.
 * @returns the value of that field.
 */
export function readName({ name }) { return name; }
`;
