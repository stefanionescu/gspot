import type { TSESLint, ESLintUtils } from '@typescript-eslint/utils';

export type RuleDocs = {
    level: 'recommended' | 'all' | 'none';
    description: string;
    why: string;
    fix: string;
    example: string;
};
export type ClientEnvOptions = [{ isClient: boolean; publicPrefixes: readonly string[]; allowed: readonly string[] }];
export type ImportBoundariesOptions = [{ folders: readonly string[]; aliases: Record<string, string> }];
export type TrivialFunctionsOptions = [{ trivialStatements: number }];

export type TrivialFilesOptions = [{ trivialStatements: number; allowIndex: boolean }];
export type RuleContext = Readonly<TSESLint.RuleContext<string, unknown[]>>;

/** Keeps the required docs of each rule in the type that RuleCreator returns. */
export type DocumentedRuleCreator = <Options extends readonly unknown[], MessageIds extends string>(
    rule: Readonly<ESLintUtils.RuleWithMetaAndName<Options, MessageIds, RuleDocs>>,
) => TSESLint.RuleModule<MessageIds, Options, RuleDocs> & {
    name: string;
    meta: TSESLint.RuleMetaData<MessageIds, RuleDocs, Options> & { docs: RuleDocs & TSESLint.RuleMetaDataDocs };
};
