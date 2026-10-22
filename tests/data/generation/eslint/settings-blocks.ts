export const DUPLICATE_RULE_CASES = [
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
export const DUPLICATE_RULE_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"target":"ESNext","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["*.ts"]}\n',
    'api.ts': '/** @deprecated Use current instead. */\nexport function legacy() { return 1; }\n',
} as const;
