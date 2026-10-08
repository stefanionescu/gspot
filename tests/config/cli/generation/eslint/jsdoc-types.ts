export const JSDOC_PROJECT = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["typed.ts"]}\n',
    'jsconfig.json':
        '{"compilerOptions":{"strict":true,"noEmit":true,"checkJs":true,"allowJs":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["missing.js","malformed.js","capitalized.js","undefined.js"]}\n',
    'missing.js':
        '/**\n * Measure the input.\n * @param value The input text.\n * @returns The input length.\n */\nexport function measure(value) { return value.length; }\n',
    'malformed.js':
        '/**\n * Measure the input.\n * @param {string[} value The input text.\n * @returns {number} The input length.\n */\nexport function measure(value) { return value.length; }\n',
    'capitalized.js':
        '/**\n * Measure the input.\n * @param {String} value The input text.\n * @returns {number} The input length.\n */\nexport function measure(value) { return value.length; }\n',
    'undefined.js':
        '/**\n * Measure the input.\n * @param {MissingType} value The input text.\n * @returns {number} The input length.\n */\nexport function measure(value) { return value.length; }\n',
    'typed.ts':
        '/**\n * Measure the input.\n * @param value The input text.\n * @returns The input length.\n */\nexport function measure(value: string): number { return value.length; }\n',
};

export const JSDOC_CORRECTION =
    '/**\n * Measure the input.\n * @param {string} value The input text.\n * @returns {number} The input length.\n */\nexport function measure(value) { return value.length; }\n';

export const JSDOC_RULES = [
    'jsdoc/require-param-type',
    'jsdoc/require-returns-type',
    'jsdoc/valid-types',
    'jsdoc/check-types',
    'jsdoc/no-undefined-types',
];

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
];

export const JSDOC_COMPILER_ARGV = [
    'node',
    'node_modules/typescript/lib/tsc.js',
    '--project',
    '.gspot/config/jsconfig.json',
    '--pretty',
    'false',
];
