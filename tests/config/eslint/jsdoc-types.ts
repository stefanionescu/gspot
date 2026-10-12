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

export const FIXED_JSDOC = `/**
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
            { ruleId: 'jsdoc/require-param-type', line: 3, column: 1, severity: 2 },
            { ruleId: 'jsdoc/require-returns-type', line: 4, column: 1, severity: 2 },
        ],
    },
    { file: 'malformed.js', findings: [{ ruleId: 'jsdoc/valid-types', line: 3, column: 1, severity: 2 }] },
    { file: 'capitalized.js', findings: [{ ruleId: 'jsdoc/check-types', line: 3, column: 1, severity: 2 }] },
    { file: 'undefined.js', findings: [{ ruleId: 'jsdoc/no-undefined-types', line: 3, column: 1, severity: 2 }] },
    { file: 'typed.ts', findings: [] },
] as const;

export const TSC_ARGV = [
    'node',
    'node_modules/typescript/lib/tsc.js',
    '--project',
    '.gspot/config/jsconfig.json',
    '--pretty',
    'false',
] as const;
