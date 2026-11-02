import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

export type TrivialFunctionsOptions = [
    {
        trivialFunctionStatements: number;
        exportNames: readonly { files: readonly string[]; names: readonly string[] }[];
    },
];

export type ReturnScope = {
    codePath: TSESLint.CodePath;
    segments: Set<TSESLint.CodePathSegment>;
    returns: TSESTree.ReturnStatement[];
    frames: { effect: boolean; returns: boolean }[];
    kinds: Set<string>;
};

export type CallNode = TSESTree.CallExpression | TSESTree.NewExpression;

export type ParameterNames = readonly (string | undefined)[];

export type SwappedPair = readonly [string, string];

export type PromiseUse = 'blocking' | 'handled' | 'caught' | 'open';
