// Type aliases of the plugin modules.
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

export type RuleSpec<Options extends readonly unknown[], MessageIds extends string> = Readonly<{
    name: string;
    meta: Omit<TSESLint.RuleMetaData<MessageIds, RuleDocs, Options>, 'docs'> & { docs: RuleDocs };
    defaultOptions: Readonly<Options>;
    create: (
        context: Readonly<TSESLint.RuleContext<MessageIds, Options>>,
        defaultedOptions: Readonly<Options>,
    ) => TSESLint.RuleListener;
}>;

export type RuleDocs = {
    summary: string;
    why: string;
    fix: string;
};

export type DirectoryEntry = { name: string; kind: 'file' | 'dir' };

export type ImportPathStyleName = 'js' | 'ts' | 'extensionless';

export type TypesPlacementMessages =
    | 'interface'
    | 'aliasOutside'
    | 'enumOutside'
    | 'runtimeInside'
    | 'defaultInside'
    | 'valueImportInside';

export type ImportLayoutEntry = {
    node: TSESTree.Statement;
    start: number;
    end: number;
    text: string;
    sortText: string;
    lineSpan: number;
    multiLine: boolean;
    index: number;
};

export type ImportDirectionRoles = {
    types?: string[];
    tests?: string[];
    harness?: string[];
    config?: string[];
    env?: string[];
    runtime?: string[];
};

export type ImportDirectionRole = 'types' | 'tests' | 'harness' | 'config' | 'env' | 'runtime' | 'other';

export type ImportDirectionMessages = 'typesOnlyTypes' | 'runtimeToTests' | 'testsToInternals' | 'configToRuntime';

export type NoCallThroughFunction =
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression;

export type RuleContextOf = Readonly<TSESLint.RuleContext<string, unknown[]>>;

/** One import as the direction rule sees it: the roles at both ends and whether only types cross. */
export type ImportEdge = {
    role: ImportDirectionRole;
    targetRole: ImportDirectionRole;
    source: string;
    target: string;
    isTypeOnly: boolean;
};

/** The nodes that carry an import source. */
export type ImportNode = TSESTree.ImportDeclaration | TSESTree.ExportAllDeclaration | TSESTree.ExportNamedDeclaration;

/** What the direction rule reports for one edge. */
export type ImportVerdict = { messageId: ImportDirectionMessages; data: Record<string, string> };

/** Reports one types-placement message with the directory filled in. */
export type TypesPlacementReporter = (
    node: TSESTree.Node,
    messageId: TypesPlacementMessages,
    extra?: Record<string, string>,
) => void;
