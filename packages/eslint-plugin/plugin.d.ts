import type { TSESLint } from '@typescript-eslint/utils';

declare const plugin: TSESLint.FlatConfig.Plugin & {
    rules: Record<string, TSESLint.RuleModule<string, readonly unknown[]>>;
    configs: { recommended: TSESLint.FlatConfig.Config; all: TSESLint.FlatConfig.Config };
};

export default plugin;
