import { createRule } from '../rule.ts';
import type { ReturnScope } from '../types/rules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    BRANCH_KEYS,
    MINIMUM_RETURNS,
    EFFECT_ONLY_BRANCH,
    BARE_RETURN_BRANCH,
    EFFECT_RETURN_BRANCH,
} from '../config/rules.ts';

function isBranchBody(node: TSESTree.BlockStatement | TSESTree.ExpressionStatement): boolean {
    const { parent } = node;
    const keys = BRANCH_KEYS.get(parent.type) ?? [];
    return keys.some((key) => Object.is(parent[key as keyof TSESTree.Node], node));
}

function readEnclosingAction(identifier: TSESTree.Node): TSESTree.Expression | undefined {
    let node: TSESTree.Node | undefined = identifier;
    while (node !== undefined && node.type !== AST_NODE_TYPES.ExpressionStatement && !ASTUtils.isFunction(node))
        node = node.parent;
    if (node?.type !== AST_NODE_TYPES.ExpressionStatement) return undefined;
    const { expression } = node;
    return expression.type === AST_NODE_TYPES.AwaitExpression ? expression.argument : expression;
}

function isChangedLater(reference: TSESLint.Scope.Reference): boolean {
    const action = readEnclosingAction(reference.identifier);
    if (reference.isWrite() || action?.type === AST_NODE_TYPES.CallExpression) return true;
    if (action?.type !== AST_NODE_TYPES.AssignmentExpression) return false;
    let target: TSESTree.Node = action.left;
    while (target.type === AST_NODE_TYPES.MemberExpression) target = target.object;
    return Object.is(target, reference.identifier);
}

function readStableVariable(node: TSESTree.Identifier, source: TSESLint.SourceCode) {
    const variable = ASTUtils.findVariable(source.getScope(node), node);
    if (variable?.scope !== source.getScope(node).variableScope) return undefined;
    return variable.references.slice(1).some((reference) => isChangedLater(reference)) ? undefined : variable;
}

function readVariableLiteral(node: TSESTree.Identifier, source: TSESLint.SourceCode): { value: unknown } | undefined {
    const definitions = readStableVariable(node, source)?.defs ?? [];
    const [definition] = definitions;
    const declarator = definitions.length === 1 ? definition?.node : undefined;
    if (declarator?.type !== AST_NODE_TYPES.VariableDeclarator || declarator.init === null) return undefined;
    return readLiteral(declarator.init, source);
}

function readLiteral(node: TSESTree.Node, source: TSESLint.SourceCode): { value: unknown } | undefined {
    if (node.type === AST_NODE_TYPES.Identifier) return readVariableLiteral(node, source);
    return ASTUtils.getStaticValue(node, source.getScope(node)) ?? undefined;
}

function isSameVariable(values: readonly TSESTree.Node[], source: TSESLint.SourceCode): boolean {
    const [first] = values;
    if (first?.type !== AST_NODE_TYPES.Identifier) return false;
    const references = readStableVariable(first, source)?.references ?? [];
    const reads = new Set<TSESTree.Node>(references.slice(1).map(({ identifier }) => identifier));
    return values.every((value) => reads.has(value));
}

function isSameLiteral(values: readonly TSESTree.Node[], source: TSESLint.SourceCode): boolean {
    const literals = values.map((value) => readLiteral(value, source));
    const [first] = literals;
    if (first === undefined) return false;
    return literals.every((literal) => literal !== undefined && Object.is(literal.value, first.value));
}

function isInvariant(scope: ReturnScope, source: TSESLint.SourceCode): boolean {
    const values = scope.returns.flatMap((statement) => (statement.argument === null ? [] : [statement.argument]));
    const isReachable = [...scope.segments].some((segment) => segment.reachable);
    if (isReachable || scope.codePath.thrownSegments.length > 0) return false;
    if (values.length < Math.max(scope.returns.length, MINIMUM_RETURNS)) return false;
    if (isSameLiteral(values, source))
        return !scope.kinds.has(EFFECT_RETURN_BRANCH) || scope.kinds.has(BARE_RETURN_BRANCH);
    return isSameVariable(values, source) && !scope.kinds.has(EFFECT_ONLY_BRANCH);
}

export const noInvariantReturns = createRule<[], 'invariant'>({
    name: 'no-invariant-returns',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports a function with two or more return statements that all return the same literal value, or the same variable that nothing changes. A function that can end without a return, returns without a value, or throws passes. A function also passes when every branch that returns the literal calls or assigns something first, or, for a variable, when a branch calls or assigns something without returning.',
            why: 'A function that always returns the same value tells its caller nothing, so its return value or its branches are probably wrong.',
            fix: 'Return the value that each branch should give, or remove the return value and the code that checks it.',
            example: '`function isValid(value) { if (value) return true; return true; }` reports `invariant`.',
        },
        schema: [],
        messages: {
            invariant: 'This function always returns the same value. Return what each branch means, or return nothing.',
        },
    },
    create(context) {
        const scopes: ReturnScope[] = [];
        const openBranch = (node: TSESTree.BlockStatement | TSESTree.SwitchCase) => {
            const isBranch = node.type === AST_NODE_TYPES.SwitchCase || isBranchBody(node);
            if (!isBranch) return;
            scopes.at(-1)?.frames.push({ effect: false, returns: false });
        };
        const leaveBranch = (node: TSESTree.BlockStatement | TSESTree.SwitchCase) => {
            const isBranch = node.type === AST_NODE_TYPES.SwitchCase || isBranchBody(node);
            if (!isBranch) return;
            const scope = scopes.at(-1);
            const frame = scope?.frames.pop();
            scope?.kinds.add(`${String(frame?.effect)},${String(frame?.returns)}`);
        };
        const recordEffect = (node: TSESTree.ExpressionStatement) => {
            const scope = scopes.at(-1);
            const frame = scope?.frames.at(-1);
            if (frame !== undefined) frame.effect = true;
            if (isBranchBody(node)) scope?.kinds.add(EFFECT_ONLY_BRANCH);
        };
        const trackSegment = (segment: TSESLint.CodePathSegment) => {
            const segments = scopes.at(-1)?.segments;
            if (segments?.has(segment) === true) segments.delete(segment);
            else segments?.add(segment);
        };
        return {
            onCodePathStart: (codePath: TSESLint.CodePath) => {
                scopes.push({ codePath, segments: new Set(), returns: [], frames: [], kinds: new Set() });
            },
            onCodePathEnd: () => {
                scopes.pop();
            },
            onCodePathSegmentStart: trackSegment,
            onCodePathSegmentEnd: trackSegment,
            onUnreachableCodePathSegmentStart: trackSegment,
            onUnreachableCodePathSegmentEnd: trackSegment,
            ReturnStatement(node) {
                const scope = scopes.at(-1);
                scope?.returns.push(node);
                const frame = scope?.frames.at(-1);
                if (frame !== undefined) frame.returns = true;
            },
            BlockStatement: openBranch,
            'BlockStatement:exit': leaveBranch,
            SwitchCase: openBranch,
            'SwitchCase:exit': leaveBranch,
            'ExpressionStatement[expression.type=/^(?:Assignment|Await|Call|Update)Expression$/]': recordEffect,
            ':function:exit'(node: TSESTree.Node) {
                const scope = scopes.at(-1);
                if (scope === undefined || !isInvariant(scope, context.sourceCode)) return;
                context.report({ node, messageId: 'invariant' });
            },
        };
    },
});
