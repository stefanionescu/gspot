import type { TypeReader, FileContext } from './plugin.ts';
import type { TSESLint, TSESTree } from '@typescript-eslint/utils';

export type AssertionFinding = [TSESTree.Node, 'complete' | 'call'];

export type OrderedArguments = {
    first: TSESTree.CallExpressionArgument;
    second: TSESTree.CallExpressionArgument;
    format: string;
};

export type ChainLink = { name: TSESTree.Identifier; values: TSESTree.CallExpressionArgument[] | undefined };

export type UncertainPair = { first: string; second: string; minimum: number; needsShape: boolean };

export type AssertionChain = { values: TSESTree.Node[]; hasAssertionProperty: boolean; root: TSESTree.Node };

type AssertionPredicate = 'truthy' | 'falsy' | 'true' | 'false' | 'defined' | 'undefined' | 'null' | 'exists';

type AssertionComparison = 'strict' | 'deep' | 'loose';

export type ExpectCall = { call: TSESTree.CallExpression; negated: boolean };

type AssertionStyle = 'jest-like' | 'jasmine' | 'playwright' | 'chai-bdd' | 'chai-assert' | 'node-assert' | 'cypress';

export type Assertion = {
    received: TSESTree.Expression;
    negated: boolean;
    style: AssertionStyle;
    report: TSESTree.Node;
} & (
    | { kind: 'predicate'; predicate: AssertionPredicate; node: TSESTree.Node }
    | {
          kind: 'comparison';
          comparison: AssertionComparison;
          expected: TSESTree.Expression;
          node: TSESTree.CallExpression;
      }
);

export type AssertionChecks = {
    style: AssertionStyle;
    predicate?: AssertionPredicate | undefined;
    comparison?: AssertionComparison | undefined;
    negated: boolean;
};

export type AssertionStyles = {
    expect: 'jest-like' | 'jasmine' | 'playwright' | undefined;
    chai: boolean;
    nodeAssert: boolean;
    cypress: boolean;
    globalExpect: boolean;
};

export type AssertionKind = 'script' | 'runner' | 'type';

export type ChaiChain = { received: TSESTree.Expression; names: Array<string | null> };

export type AssertedValue = { isFresh: boolean; isConstant: boolean; value: unknown };

export type ConstantFinding = {
    node: TSESTree.Node;
    messageId: 'constant' | 'fresh' | 'identity';
    matcher?: string;
};

export type ComparisonAssertion = Assertion & { kind: 'comparison' };

export type MatcherSuggestion = {
    kind: string;
    received: TSESTree.Node;
    expected?: TSESTree.Node | undefined;
    negated: boolean;
};

export type ThrowAssertion = {
    expect: TSESTree.CallExpression;
    received: TSESTree.Expression;
    target: TSESTree.Node;
    matcher: string;
};

export type AssertionSearch = {
    context: FileContext;
    source: TSESLint.SourceCode;
    types: TypeReader | undefined;
    visited: Map<TSESTree.Node, boolean>;
};

export type PlacementState = {
    reported: Set<TSESTree.Node>;
    topLevel: Map<TSESTree.Node, boolean>;
    hasTests: boolean;
};

export type ThenCall = { property: TSESTree.Node; receiver: TSESTree.Expression; parameter: string };

export type CallbackScope = { kinds: Map<string, string>; yielded: Set<string> };
