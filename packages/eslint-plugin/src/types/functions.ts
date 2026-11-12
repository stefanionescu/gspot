import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

export type TrivialFunctionsOptions = [{ trivialFunctionStatements: number }];

export type ReturnScope = {
    codePath: TSESLint.CodePath;
    segments: Set<TSESLint.CodePathSegment>;
    returns: TSESTree.ReturnStatement[];
    frames: Array<{ effect: boolean; returns: boolean }>;
    kinds: Set<string>;
};

export type ParameterNames = ReadonlyArray<string | undefined>;

export type SwappedPair = readonly [string, string];

export type PromiseUse = 'blocking' | 'handled' | 'caught' | 'open';
