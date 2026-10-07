import type { RuleDocs } from './create-rule.ts';
import type { TSESLint } from '@typescript-eslint/utils';

/** The plugin's metadata and rule modules before its level configurations are attached. */
export type Plugin = {
    meta: { name: string; version: string };
    rules: Record<string, TSESLint.RuleModule<string, readonly unknown[], RuleDocs>>;
};
