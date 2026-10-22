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

/** A JavaScript repository with no TypeScript source or tsconfig.json. */
export const ESLINT_SANDBOX = {
    configurations: ['javascript'],

    files: {
        'package.json': '{"name":"example","version":"1.0.0","private":true,"type":"module"}\n',
        'src/main.js': JAVASCRIPT_MODULE,
        'src/index.js': "// The entry point.\nexport { twice } from './main.js';\n",
    },
} as const;
