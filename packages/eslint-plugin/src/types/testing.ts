import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

export type SuiteMember = {
    call: TSESTree.CallExpression;
    index: number;
    kind: TestCall['kind'];
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

export type TestOrigin = { name: string; module: string | undefined };

export type TestCallee = TestOrigin & { base: TSESTree.Identifier; modifiers: string[] };

export type TestCall = TestCallee & {
    kind: 'test' | 'suite' | 'hook';
    callback: TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression | undefined;
};

export type QueryUse = { method: TSESTree.Identifier; isPresence: boolean };

export type UiFrameworks = { hasCypress: boolean; hasPlaywright: boolean };
