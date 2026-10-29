import type { RuleDocs } from './rules.ts';
import { type TSESLint, type ESLintUtils } from '@typescript-eslint/utils';

export type DocumentedRuleCreator = <Options extends readonly unknown[], MessageIds extends string>(
    rule: Readonly<ESLintUtils.RuleWithMetaAndName<Options, MessageIds, RuleDocs>>,
) => TSESLint.RuleModule<MessageIds, Options, RuleDocs> & {
    name: string;
    meta: TSESLint.RuleMetaData<MessageIds, RuleDocs, Options> & { docs: RuleDocs & TSESLint.RuleMetaDataDocs };
};
