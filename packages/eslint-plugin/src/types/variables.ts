import type { FunctionNode } from './plugin.ts';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

export type MagicNumbersOptions = [Record<string, unknown>];

export type NamedNode =
    | FunctionNode
    | TSESTree.VariableDeclarator
    | TSESTree.CatchClause
    | TSESTree.AssignmentExpression
    | TSESTree.UpdateExpression;

export type NameSet = {
    names: TSESTree.Identifier[];
    kind: 'function' | 'parameter' | 'variable' | 'assignment';
    unset: readonly TSESTree.Node[];
};

export type AssignedValues = ReadonlySet<string> | null;

export type ValueState = Map<TSESLint.Scope.Variable | null, AssignedValues>;

export type SegmentFlow = {
    segment: TSESLint.CodePathSegment;
    incoming: ValueState;
    outgoing: ValueState;
    references: Set<TSESLint.Scope.Reference>;
};

export type AssignmentFrame = {
    node: TSESTree.AssignmentExpression | TSESTree.VariableDeclarator;
    left: Set<TSESLint.Scope.Reference>;
    right: Set<TSESLint.Scope.Reference>;
};

export type PathFrame = {
    codePath: TSESLint.CodePath;
    assignments: AssignmentFrame[];
    segments: TSESLint.CodePathSegment[];
};

export type KeyWrite = { collection: TSESTree.Node; key: string; node: TSESTree.Node };

export type GroupRead = { node: TSESTree.Node; name: string };
