import type { TSESTree } from '@typescript-eslint/utils';

export type ImportNode = TSESTree.ImportDeclaration | TSESTree.ExportAllDeclaration | TSESTree.ExportNamedDeclaration;

export type ImportSource = ImportNode | TSESTree.ImportExpression;
