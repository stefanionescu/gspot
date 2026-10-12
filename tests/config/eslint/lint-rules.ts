const DUPLICATE_RULE_CASES = [
    {
        file: 'empty-regex.js',
        source: 'export const pattern = /[]/;\n',
        kept: 'regexp/no-empty-character-class',
        rules: ['no-empty-character-class', 'regexp/no-empty-character-class', 'sonarjs/no-empty-character-class'],
    },
    {
        file: 'catch.js',
        source: "export function run() { try { console.log('ready'); } catch (error) { throw error; } }\n",
        kept: 'no-useless-catch',
        rules: ['no-useless-catch', 'sonarjs/no-useless-catch'],
    },
    {
        file: 'nested-if.js',
        source: "export function run() { if (Date.now()) { if (Math.random()) { console.log('ready'); } } }\n",
        kept: 'sonarjs/no-collapsible-if',
        rules: ['unicorn/no-lonely-if', 'sonarjs/no-collapsible-if'],
    },
    {
        file: 'unused.ts',
        source: 'export function run() { const unused = 1; return 2; }\n',
        kept: '@typescript-eslint/no-unused-vars',
        rules: [
            'no-unused-vars',
            '@typescript-eslint/no-unused-vars',
            'sonarjs/no-unused-vars',
            'sonarjs/unused-import',
        ],
    },
    {
        file: 'eval.js',
        source: 'export const result = eval(process.env.SCRIPT);\n',
        kept: 'sonarjs/code-eval',
        rules: ['security/detect-eval-with-expression', 'sonarjs/code-eval'],
    },
    {
        file: 'buffer.js',
        source: 'export const result = new Buffer(8);\n',
        kept: 'n/no-deprecated-api',
        rules: ['security/detect-new-buffer', 'n/no-deprecated-api'],
    },
    {
        file: 'slow-regex.js',
        source: 'export const pattern = /^(a+)+$/;\n',
        kept: 'regexp/no-super-linear-backtracking',
        rules: ['regexp/no-super-linear-backtracking', 'sonarjs/slow-regex', 'security/detect-unsafe-regex'],
    },
    {
        file: 'deprecated.ts',
        source: "import { legacy } from './api.js';\nexport const result = legacy();\n",
        kept: '@typescript-eslint/no-deprecated',
        rules: ['@typescript-eslint/no-deprecated', 'sonarjs/deprecation'],
    },
] as const;

const DUPLICATE_RULE_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"target":"ESNext","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["*.ts"]}\n',
    'api.ts': '/** @deprecated Use current instead. */\nexport function legacy() { return 1; }\n',
} as const;

const REQUIRED_RULE_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true,"jsx":"react-jsx"},"include":["**/*"]}\n',
} as const;

const REQUIRED_RULES = [
    {
        configuration: 'svelte',
        ending: 'svelte',
        rules: {
            'svelte/no-at-html-tags': 'recommended',
            'svelte/require-each-key': 'recommended',
            'svelte/no-target-blank': 'recommended',
        },
    },
    {
        configuration: 'vue',
        ending: 'vue',
        rules: {
            'vue/no-v-html': 'recommended',
            'vue/require-v-for-key': 'recommended',
            'vue/no-mutating-props': 'recommended',
            'vue/no-use-v-if-with-v-for': 'recommended',
        },
    },
    {
        configuration: 'expo',
        ending: 'ts',
        rules: {
            'expo/no-env-var-destructuring': 'recommended',
            'expo/no-dynamic-env-var': 'recommended',
        },
    },
    {
        configuration: 'expo',
        ending: 'js',
        rules: {
            'expo/no-env-var-destructuring': 'recommended',
            'expo/no-dynamic-env-var': 'recommended',
        },
    },
    {
        configuration: 'expo',
        ending: 'tsx',
        rules: {
            'expo/no-env-var-destructuring': 'recommended',
            'expo/no-dynamic-env-var': 'recommended',
        },
    },
    {
        configuration: 'expo',
        ending: 'jsx',
        rules: {
            'expo/no-env-var-destructuring': 'recommended',
            'expo/no-dynamic-env-var': 'recommended',
        },
    },
    {
        configuration: 'nextjs',
        ending: 'tsx',
        rules: {
            '@next/next/no-html-link-for-pages': 'all',
            '@next/next/no-async-client-component': 'recommended',
        },
    },
    {
        configuration: 'nestjs',
        ending: 'ts',
        rules: {
            '@typescript-eslint/no-extraneous-class': 'all',
            'no-restricted-syntax': 'recommended',
        },
    },
    {
        configuration: 'astro',
        ending: 'astro',
        rules: {
            'astro/valid-compile': 'recommended',
            'astro/no-set-html-directive': 'recommended',
            'astro/jsx-a11y/alt-text': 'recommended',
        },
    },
    {
        configuration: 'react',
        ending: 'jsx',
        rules: {
            'react-hooks/rules-of-hooks': 'recommended',
            'react-hooks/exhaustive-deps': 'recommended',
            'react/jsx-key': 'recommended',
            'react/no-danger': 'recommended',
        },
    },
    {
        configuration: 'react',
        ending: 'tsx',
        rules: {
            'react-hooks/rules-of-hooks': 'recommended',
            'react-hooks/exhaustive-deps': 'recommended',
            'react/jsx-key': 'recommended',
            'react/no-danger': 'recommended',
        },
    },
    {
        configuration: 'typescript',
        ending: 'ts',
        rules: {
            '@typescript-eslint/no-explicit-any': 'all',
            '@typescript-eslint/no-floating-promises': 'recommended',
        },
    },
    {
        configuration: 'javascript',
        ending: 'js',
        rules: {
            eqeqeq: 'recommended',
            'no-restricted-syntax': 'recommended',
            'max-lines': 'all',
            'sonarjs/cognitive-complexity': 'all',
            'import-x/exports-last': 'all',
        },
    },
] as const;

const REQUIRED_RULE_CASES = REQUIRED_RULES.flatMap((entry) =>
    (entry.configuration === 'nextjs' ? ['pages', 'app'] : ['src']).map((route) => ({ ...entry, route })),
);

export { REQUIRED_RULE_FILES, REQUIRED_RULE_CASES, DUPLICATE_RULE_CASES, DUPLICATE_RULE_FILES };

export const ESLINT_SEVERITIES = [0, 1, 2] as const;
