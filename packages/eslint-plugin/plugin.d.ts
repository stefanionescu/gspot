/* eslint-disable gspot/no-trivial-files -- reason: npm exposes this declaration file as the public type entry for the bundled plugin. */
import type { TSESLint } from '@typescript-eslint/utils';

declare const plugin: TSESLint.FlatConfig.Plugin & {
    rules: Record<string, TSESLint.RuleModule<string, readonly unknown[]>>;
    configs: { recommended: TSESLint.FlatConfig.Config; all: TSESLint.FlatConfig.Config };
};

export default plugin;
