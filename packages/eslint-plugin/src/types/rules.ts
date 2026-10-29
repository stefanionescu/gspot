import { type TSESTree, type TSESLint } from '@typescript-eslint/utils';

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

export type RelativeImport = { target: string; query: string };

export type TrivialFunctionsOptions = [{ trivialFunctionStatements: number }];

export type TrivialFilesOptions = [{ allowIndex: boolean }];

export type MagicNumbersOptions = [Record<string, unknown>];

export type RuleContext = Readonly<TSESLint.RuleContext<string, unknown[]>>;

export type FunctionNode =
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression;

export type ImportBlock = { first: TSESTree.Statement; last: TSESTree.Statement };
