import { type TSESTree, type TSESLint } from '@typescript-eslint/utils';

export type ClientEnvOptions = [
    { client: boolean; publicPrefixes: readonly string[]; allowedNames: readonly string[] },
];

export type ImportBoundariesOptions = [
    { folders: readonly string[]; aliases: Record<string, string>; externals: readonly string[] },
];

export type RelativeImport = { target: string; query: string };

export type RenamedValue = { node: TSESTree.Node; name: string; source: string };

export type TrivialFunctionsOptions = [{ trivialFunctionStatements: number }];

export type TrivialFilesOptions = [{ allowIndex: boolean }];

export type MagicNumbersOptions = [Record<string, unknown>];

export type RuleContext = Readonly<TSESLint.RuleContext<string, unknown[]>>;

export type FunctionNode =
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression;

export type ImportBlock = { first: TSESTree.Statement; last: TSESTree.Statement };

export type CommentGroup = { first: TSESTree.Comment; last: TSESTree.Comment; comments: TSESTree.Comment[] };

export type SwitchCasesOptions = [number];

export type Branch = { node: TSESTree.Node; body: readonly TSESTree.Node[] };

export type BranchSet = {
    owner: TSESTree.Node;
    kind: string;
    branches: readonly Branch[];
    closing: 'none' | 'empty' | 'filled';
};

export type KeyWrite = { collection: TSESTree.Node; key: string; node: TSESTree.Node };

export type ReturnScope = {
    codePath: TSESLint.CodePath;
    segments: Set<TSESLint.CodePathSegment>;
    returns: TSESTree.ReturnStatement[];
    frames: { effect: boolean; returns: boolean }[];
    kinds: Set<string>;
};

export type NameSet = {
    names: TSESTree.Identifier[];
    kind: 'function' | 'parameter' | 'variable' | 'assignment';
    unset: readonly TSESTree.Node[];
};

export type PromiseUse = 'blocking' | 'handled' | 'caught' | 'open';
export type FileContext = Pick<RuleContext, 'filename' | 'settings' | 'sourceCode'>;

export type SuiteMember = {
    call: TSESTree.CallExpression;
    index: number;
    kind: 'test' | 'suite' | 'hook';
    isAfter: boolean;
};

export type TableCall = TSESTree.CallExpression & { callee: TSESTree.CallExpression };

export type SimilarTest = {
    title: TSESTree.Node;
    body: TSESTree.Statement[];
    literals: Map<number, TSESTree.Literal>;
};

export type TitleScan = {
    source: TSESLint.SourceCode;
    path: Set<TSESTree.Node>;
    report: (node: TSESTree.Node) => void;
};

export type SkipFramework = 'jasmine' | 'jest' | 'vitest' | 'mocha' | 'playwright';

export type EarlyReturnFramework = 'mocha' | 'vitest' | 'playwright' | 'nodeTest' | 'bun';

export type PackageFacts = { dependencies: ReadonlySet<string>; manifests: number };

export type TestOrigin = { name: string; module: string | undefined };

export type TestCallee = TestOrigin & { base: TSESTree.Identifier; modifiers: string[] };

export type TestCall = TestCallee & {
    kind: 'test' | 'suite' | 'hook';
    callback: TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression | undefined;
};
