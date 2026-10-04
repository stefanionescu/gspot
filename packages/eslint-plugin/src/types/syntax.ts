import type { TSESTree } from '@typescript-eslint/utils';

export type ImplementedFunction =
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression;

/** A syntax owner that binds an implemented function to a lexical name. */
export type FunctionBinding = { node: TSESTree.Node; id: TSESTree.Node | null };

/** Expressions that preserve the identity of their wrapped value. */
export type ValueOperand =
    | TSESTree.ChainExpression
    | TSESTree.TSAsExpression
    | TSESTree.TSSatisfiesExpression
    | TSESTree.TSNonNullExpression
    | TSESTree.TSTypeAssertion
    | TSESTree.TSInstantiationExpression;
