import type ts from 'typescript';
import type { TSESTree, ParserServicesWithTypeInformation } from '@typescript-eslint/utils';

export type ImplementedFunction =
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression;

/** The node that gives a function its name, and that name. */
export type NamedFunction = { node: TSESTree.Node; id: TSESTree.Node | null };

export type ImportSource =
    | TSESTree.ImportDeclaration
    | TSESTree.ExportAllDeclaration
    | TSESTree.ExportNamedDeclaration
    | TSESTree.ImportExpression;
export type ContentCheck = (node: TSESTree.Node | null) => boolean;

export type TypeServices = {
    checker: ts.TypeChecker;
    mapping: ParserServicesWithTypeInformation['esTreeNodeToTSNodeMap'];
};
