import type { TSESTree } from '@typescript-eslint/utils';

export type ImplementedFunction =
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression;

/** A syntax owner that binds an implemented function to a lexical name. */
export type NamedFunction = { node: TSESTree.Node; id: TSESTree.Node | null };

export type ImportSource =
    | TSESTree.ImportDeclaration
    | TSESTree.ExportAllDeclaration
    | TSESTree.ExportNamedDeclaration
    | TSESTree.ImportExpression;
export type StatementStart = { offset: number; line: number };
export type ContentCheck = (node: TSESTree.Node | null) => boolean;
