import type { TSESLint, TSESTree, ParserServicesWithTypeInformation } from '@typescript-eslint/utils';

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

export type CallText = { argument: TSESTree.CallExpressionArgument; text: string };

export type MemberAssignment = { variable: TSESLint.Scope.Variable; property: string };

export type CdkPropertyCheck = {
    path: readonly string[];
    required: boolean;
    position?: number;
    valid?: readonly unknown[];
    invalid?: readonly unknown[];
    validNames?: readonly string[];
    invalidNames?: readonly string[];
};

export type CdkIssue = { node: TSESTree.Node; kind: 'omitted' | 'invalid' };

export type CdkTarget = { value: TSESTree.Node; report: TSESTree.Node };

export type CdkLiteralTarget = { literal: TSESTree.ObjectExpression; report: TSESTree.Node };

export type CdkPathResult = { targets: CdkTarget[]; issues: CdkIssue[] };

type PolicyKeys = {
    effect: string;
    allow: string;
    actions: string;
    resources: string;
    conditions: string;
    principals: string;
    isJson: boolean;
};

export type CdkResult = { status: 'found' | 'missing' | 'unknown'; node: TSESTree.Node };

export type PolicyStatement = { statement: CdkResult; keys: PolicyKeys };

export type CdkFinding = CdkIssue & { property: string };

export type JsxAttributeValue = { node: TSESTree.JSXAttribute; value: unknown };

export type TableCell = {
    isHeader: boolean;
    headers: string[] | undefined;
    id: string | undefined;
    node: TSESTree.JSXElement;
    block: number;
    rowSpan: number;
};

export type PlacedRow = { cells: TableCell[]; isUsed: boolean; isOpen: boolean };
