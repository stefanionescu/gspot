import type { TSESTree, ParserServicesWithTypeInformation } from '@typescript-eslint/utils';

export type RuleDocs = {
    level: 'recommended' | 'all' | 'none';
    description: string;
    why: string;
    fix: string;
    example: string;
};

export type ImportSource =
    | TSESTree.ImportDeclaration
    | TSESTree.ExportAllDeclaration
    | TSESTree.ExportNamedDeclaration
    | TSESTree.ImportExpression
    | TSESTree.TSImportType;

export type LocalFunction =
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression
    | TSESTree.TSDeclareFunction;

type TypeChecker = ReturnType<ParserServicesWithTypeInformation['program']['getTypeChecker']>;

export type CheckedType = ReturnType<TypeChecker['getTypeAtLocation']>;

export type TypeReader = {
    program: ParserServicesWithTypeInformation['program'];
    checker: TypeChecker;
    read: (node: TSESTree.Node) => CheckedType;
    map: ParserServicesWithTypeInformation['esTreeNodeToTSNodeMap'];
};

export type TypeCategory = 'array' | 'string' | 'number' | 'boolean' | 'other';
