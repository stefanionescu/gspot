import type { TableCell } from './plugin.ts';
import { type TSESTree, type TSESLint } from '@typescript-eslint/utils';

export type ClientEnvOptions = [
    { client: boolean; publicPrefixes: readonly string[]; allowedNames: readonly string[] },
];

export type ImportBoundariesOptions = [
    { folders: readonly string[]; aliases: Record<string, string>; externals: readonly string[] },
];

export type RelativeImport = { target: string; query: string };

export type RenamedValue = { node: TSESTree.Node; name: string; source: string };

export type TrivialFunctionsOptions = [
    {
        trivialFunctionStatements: number;
        exportNames: readonly { files: readonly string[]; names: readonly string[] }[];
    },
];

export type RestrictedSyntaxOptions = readonly {
    selector: string;
    message: string;
    files?: readonly string[];
    ignores?: readonly string[];
}[];

export type TrivialFilesOptions = [
    { reexports: 'none' | 'index-only'; indexExports: number; forwardingFiles: readonly string[] },
];

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

export type PackageFacts = { dependencies: ReadonlyMap<string, string>; manifests: number };

export type TestOrigin = { name: string; module: string | undefined };

export type TestCallee = TestOrigin & { base: TSESTree.Identifier; modifiers: string[] };

export type TestCall = TestCallee & {
    kind: 'test' | 'suite' | 'hook';
    callback: TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression | undefined;
};

export type AssertionFinding = [TSESTree.Node, 'complete' | 'call'];

export type OrderedArguments = {
    first: TSESTree.CallExpressionArgument;
    second: TSESTree.CallExpressionArgument;
    format: string;
};

export type ChainLink = { name: TSESTree.Identifier; values: TSESTree.CallExpressionArgument[] | undefined };

export type UncertainPair = { first: string; second: string; minimum: number; needsShape: boolean };

export type QueryUse = { method: TSESTree.Identifier; isPresence: boolean };

export type MemberCall = TSESTree.CallExpression & { callee: TSESTree.MemberExpression };

export type ExpectSubject = { value: TSESTree.CallExpressionArgument; isNegated: boolean };

export type UiFrameworks = { hasCypress: boolean; hasPlaywright: boolean };

export type AssertionChain = { values: TSESTree.Node[]; hasAssertionProperty: boolean; root: TSESTree.Node };

export type VersionCeiling = { version: number[]; isInclusive: boolean };

export type StateHook = {
    call: TSESTree.CallExpression;
    value: TSESTree.Identifier;
    setter: TSESTree.Identifier;
    name: TSESTree.Node;
};

export type MethodCall = { call: TSESTree.CallExpression; method: string };

export type UploadForm = { node: TSESTree.Node; hasFolder: boolean; keepsExtensions: boolean };

export type SizedForm = { node: TSESTree.Node; size: number };

export type UploadCall = TSESTree.CallExpression | TSESTree.NewExpression;

export type EscapingSetting = { argument: number; property: string; value: boolean };

export type StorageIssue = { node: TSESTree.Node; messageId: 'omitted' | 'unencrypted' };

export type AdminAccess = { node: TSESTree.Node; messageId: 'openRange' | 'anyAddress' };

export type ClearTextListener = {
    kind: 'call' | 'construct';
    position: number;
    protocols: readonly string[];
    omission: { path: readonly string[]; required: boolean; invalid?: readonly unknown[] };
};

export type PublicGrant = TSESLint.ReportDescriptor<'accessLevel' | 'unrestricted'>;

export type ClearTextReport = TSESLint.ReportDescriptor<
    'clearText' | 'transitEncryption' | 'streamEncryption' | 'noTls'
>;

export type TableBlock = {
    cell: TableCell;
    firstRow: number;
    lastRow: number;
    firstColumn: number;
    lastColumn: number;
};

export type HeaderIssue = TSESLint.ReportDescriptor<'otherHeader' | 'unknownHeader'>;

export type ScriptSettings = { sources: number; isVersioned: boolean; hasIntegrity: boolean; isAnonymous: boolean };

export type IntegrityMessage = 'missingBoth' | 'missingIntegrity' | 'missingCrossOrigin';

export type GroupRead = { node: TSESTree.Node; name: string };

export type TestedName = { identifier: TSESTree.Identifier; value: 'truthy' | 'falsy' };

export type DecidedVariable = { variable: TSESLint.Scope.Variable; value: TestedName['value'] };
