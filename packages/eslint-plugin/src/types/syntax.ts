import type { TSESTree } from '@typescript-eslint/utils';

export type ImplementedFunction =
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression;

export type ImportSource =
    | TSESTree.ImportDeclaration
    | TSESTree.ExportAllDeclaration
    | TSESTree.ExportNamedDeclaration
    | TSESTree.ImportExpression;
