import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

export type SwitchCasesOptions = [number];

export type Branch = { node: TSESTree.Node; body: readonly TSESTree.Node[] };

export type BranchSet = {
    owner: TSESTree.Node;
    kind: string;
    branches: readonly Branch[];
    closing: 'none' | 'empty' | 'filled';
};

export type TestedName = { identifier: TSESTree.Identifier; value: 'truthy' | 'falsy' };

export type DecidedVariable = { variable: TSESLint.Scope.Variable; value: TestedName['value'] };
