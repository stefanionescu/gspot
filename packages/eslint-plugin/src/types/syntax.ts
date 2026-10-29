import { type TSESTree } from '@typescript-eslint/utils';

export type ImportSource =
    | TSESTree.ImportDeclaration
    | TSESTree.ExportAllDeclaration
    | TSESTree.ExportNamedDeclaration
    | TSESTree.ImportExpression
    | TSESTree.TSImportType;
