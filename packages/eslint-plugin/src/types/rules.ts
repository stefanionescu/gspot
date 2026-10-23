import type { TSESLint, ESLintUtils } from '@typescript-eslint/utils';

export type RuleDocs = {
    level: 'recommended' | 'all' | 'none';
    description: string;
    why: string;
    fix: string;
    example: string;
};
export type ClientEnvOptions = [
    { client: boolean; publicPrefixes: readonly string[]; allowedNames: readonly string[] },
];
export type ImportBoundariesOptions = [
    { folders: readonly string[]; aliases: Record<string, string>; externals: readonly string[] },
];
export type TrivialFunctionsOptions = [{ trivialFunctionStatements: number }];

export type TrivialFilesOptions = [{ allowIndex: boolean }];

export type MagicNumbersOptions = [Record<string, unknown>];
export type RuleContext = Readonly<TSESLint.RuleContext<string, unknown[]>>;

export type DocumentedRuleCreator = <Options extends readonly unknown[], MessageIds extends string>(
    rule: Readonly<ESLintUtils.RuleWithMetaAndName<Options, MessageIds, RuleDocs>>,
) => TSESLint.RuleModule<MessageIds, Options, RuleDocs> & {
    name: string;
    meta: TSESLint.RuleMetaData<MessageIds, RuleDocs, Options> & { docs: RuleDocs & TSESLint.RuleMetaDataDocs };
};

export type SchemaLocationOptions = [{ folders: readonly string[] }];
