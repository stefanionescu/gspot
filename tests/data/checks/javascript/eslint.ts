export const JAVASCRIPT_MODULE = `// Doubles numbers.

/**
 * Doubles a number.
 * @param {number} value the value
 * @returns {number} twice the value
 */
export function twice(value) {
    return value * 2;
}
`;

/** A JavaScript repository with no TypeScript source or compiler config file. */
export const ESLINT_SANDBOX = {
    configurations: ['javascript'],

    files: {
        'package.json': '{"name":"example","version":"1.0.0","private":true,"type":"module"}\n',
        'src/main.js': JAVASCRIPT_MODULE,
        'src/index.js': "// The entry point.\nexport { twice } from './main.js';\n",
    },
} as const;

export const JSCONFIG_SCOPE_SETTINGS = `[[scope]]
path = "app"

configurations = ["javascript"]
`;

export const FORMAT_SOURCE =
    '/** @param {string} value */\nexport function format(value) { return value.toUpperCase(); }\n';

export const PRIVATE_FINDING = {
    file: 'source.js',
    line: 3,
    column: 23,
    rule: 'TS2304',
    message: "Cannot find name 'privateValue'.",
} as const;

export const CALL_FINDING = {
    file: 'source.js',
    line: 2,
    column: 28,
    rule: 'TS2345',
    message: "Argument of type 'number' is not assignable to parameter of type 'string'.",
} as const;
