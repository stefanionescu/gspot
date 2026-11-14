import type { TSESLint, TSESTree, ParserServicesWithTypeInformation } from '@typescript-eslint/utils';

export type RuleDocs = {
    level: 'recommended' | 'all' | 'none';
    requiresTypeChecking?: boolean;
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

export type CheckedSignature = NonNullable<ReturnType<TypeChecker['getSignatureFromDeclaration']>>;

export type TypeReader = {
    program: ParserServicesWithTypeInformation['program'];
    checker: TypeChecker;
    get: (node: TSESTree.Node) => CheckedType;
    map: ParserServicesWithTypeInformation['esTreeNodeToTSNodeMap'];
};

export type TypeCategory = 'array' | 'string' | 'number' | 'boolean' | 'other';

export type CallText = { argument: TSESTree.CallExpressionArgument; text: string };

export type CounterUpdate = { counter: TSESTree.Node; operator: string };

export type MemberAssignment = { variable: TSESLint.Scope.Variable; property: string };

export type RuleContext = Readonly<TSESLint.RuleContext<string, unknown[]>>;

export type FunctionNode = Exclude<LocalFunction, TSESTree.TSDeclareFunction>;

export type FileContext = Pick<RuleContext, 'filename' | 'settings' | 'sourceCode'>;

export type PackageFacts = { dependencies: ReadonlyMap<string, string>; manifests: number };

export type VersionCeiling = { version: number[]; isInclusive: boolean };

export type MemberCall = TSESTree.CallExpression & { callee: TSESTree.MemberExpression };

export type CallNode = TSESTree.CallExpression | TSESTree.NewExpression;
