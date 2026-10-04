export const BUILD_FORMATS = [
    ['esm', 'plugin.js'],
    ['cjs', 'plugin.cjs'],
] as const;

export const ALL_RULES_PATH = '../cli/configurations/language/javascript/eslint-all-rules.json';

export const JSON_INDENT = 4;

export const PLUGIN_DECLARATION =
    "import type { TSESLint } from '@typescript-eslint/utils';\n\ndeclare const plugin: { meta: { name: string; version: string }; rules: Record<string, TSESLint.RuleModule<string, readonly unknown[]>>; configs: { recommended: TSESLint.FlatConfig.Config; all: TSESLint.FlatConfig.Config } };\nexport default plugin;\n";
