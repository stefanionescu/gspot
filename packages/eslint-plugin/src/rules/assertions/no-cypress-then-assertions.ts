import { createRule } from '../../rule.ts';
import { listBodyNodes } from '../../language/syntax.ts';
import { isTestRelatedPath } from '../../libraries/testing.ts';
import type { MemberCall, FunctionNode } from '../../types/plugin.ts';
import type { ThenCall, CallbackScope } from '../../types/assertions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    STRING_CALLS,
    LITERAL_KINDS,
    SAFE_OPERANDS,
    SELECTOR_TEXT,
    THEN_CALLBACK,
    CYPRESS_QUERIES,
    ASSERTION_DEPTHS,
} from '../../config/assertions/evidence.ts';

function getCallKind(node: TSESTree.CallExpression, kinds: ReadonlyMap<string, string>): string | undefined {
    const { callee } = node;
    if (callee.type !== AST_NODE_TYPES.MemberExpression || node.arguments.length > 0) return undefined;
    const name = [getSafeKind(callee.object, kinds), ASTUtils.getPropertyName(callee)].join('.');
    return STRING_CALLS.has(name) ? 'string' : undefined;
}

function getLeafKind(node: TSESTree.Node, kinds: ReadonlyMap<string, string>): string | undefined {
    if (node.type === AST_NODE_TYPES.Identifier) return kinds.get(node.name);
    if (node.type === AST_NODE_TYPES.CallExpression) return getCallKind(node, kinds);
    const isRecordMember =
        node.type === AST_NODE_TYPES.MemberExpression && !node.computed && getSafeKind(node.object, kinds) === 'record';
    if (isRecordMember) return 'value';
    return node.type === AST_NODE_TYPES.Literal ? LITERAL_KINDS.get(typeof node.value) : undefined;
}

function getSafeKind(node: TSESTree.Node, kinds: ReadonlyMap<string, string>): string | undefined {
    const [kind, ...fields] = SAFE_OPERANDS.get(node.type) ?? [];
    if (kind === undefined) return getLeafKind(node, kinds);
    const operands = fields
        .flatMap((field): unknown => node[field as keyof TSESTree.Node])
        .filter((value): value is TSESTree.Node => value !== null && typeof value === 'object');
    return operands.every((operand) => getSafeKind(operand, kinds) !== undefined) ? kind : undefined;
}

function listChain(node: TSESTree.Node): TSESTree.Node[] {
    const chain = [node];
    let value = node;
    while (value.type === AST_NODE_TYPES.MemberExpression || value.type === AST_NODE_TYPES.CallExpression) {
        value = value.type === AST_NODE_TYPES.MemberExpression ? value.object : value.callee;
        chain.push(value);
    }
    return chain;
}

function isGlobalName(node: TSESTree.Node | undefined, name: string, source: TSESLint.SourceCode): boolean {
    const isNamed = node?.type === AST_NODE_TYPES.Identifier && node.name === name;
    const variable = isNamed ? ASTUtils.findVariable(source.getScope(node), node) : null;
    return isNamed && (variable === null || variable.defs.length === 0);
}

function isSafeArgument(
    argument: TSESTree.CallExpressionArgument,
    { isSelector, source }: { isSelector: boolean; source: TSESLint.SourceCode },
): boolean {
    const isText = argument.type === AST_NODE_TYPES.Literal || argument.type === AST_NODE_TYPES.TemplateLiteral;
    const isSelectorText = isText && SELECTOR_TEXT.test(source.getText(argument));
    return isSelector ? isSelectorText : getSafeKind(argument, new Map()) !== undefined;
}

function isRetriedQuery(node: TSESTree.CallExpression, source: TSESLint.SourceCode): boolean {
    const { callee } = node;
    const method = callee.type === AST_NODE_TYPES.MemberExpression ? ASTUtils.getPropertyName(callee) : null;
    return (
        CYPRESS_QUERIES.has(method) &&
        node.arguments.every((value, index) =>
            isSafeArgument(value, { isSelector: method === 'get' && index === 0, source }),
        )
    );
}

function isQueryChain(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const chain = listChain(node);
    const calls = chain.filter((value) => value.type === AST_NODE_TYPES.CallExpression);
    const isCalled = node.type === AST_NODE_TYPES.CallExpression && isGlobalName(chain.at(-1), 'cy', source);
    return isCalled && calls.every((call) => isRetriedQuery(call, source));
}

function isReference(node: TSESTree.Identifier): boolean {
    const { parent } = node;
    const isProperty = parent.type === AST_NODE_TYPES.MemberExpression && !parent.computed && parent.property === node;
    const isKey =
        parent.type === AST_NODE_TYPES.Property && !parent.computed && parent.key === node && parent.value !== node;
    return !isProperty && !isKey;
}

function hasYieldedReference(node: TSESTree.Node, yielded: ReadonlySet<string>, source: TSESLint.SourceCode): boolean {
    const names = listBodyNodes(node, source).filter(
        (value): value is TSESTree.Identifier => value.type === AST_NODE_TYPES.Identifier,
    );
    const references = names.filter((name) => isReference(name));
    return references.some((name) => yielded.has(name.name));
}

function getDeclarationUse(
    statement: TSESTree.VariableDeclaration,
    scope: CallbackScope,
    source: TSESLint.SourceCode,
): string {
    if (statement.kind !== 'const') return 'unsafe';
    for (const { id, init } of statement.declarations) {
        const kind = init && getSafeKind(init, scope.kinds);
        if (init === null || typeof kind !== 'string' || id.type !== AST_NODE_TYPES.Identifier) return 'unsafe';
        scope.kinds.set(id.name, kind);
        if (hasYieldedReference(init, scope.yielded, source)) scope.yielded.add(id.name);
    }
    return 'declaration';
}

function getAssertionUse(expression: TSESTree.Expression, scope: CallbackScope, source: TSESLint.SourceCode): string {
    const chain = listChain(expression);
    const calls = chain.filter(
        (value): value is TSESTree.CallExpression => value.type === AST_NODE_TYPES.CallExpression,
    );
    const values = calls.flatMap((call) => call.arguments);
    const isAssertion = [...ASSERTION_DEPTHS].some(
        ([name, depth]) => chain.length >= depth && isGlobalName(chain.at(-1), name, source),
    );
    const isSafe = values.every(
        (value) => value.type !== AST_NODE_TYPES.SpreadElement && getSafeKind(value, scope.kinds) !== undefined,
    );
    if (!isAssertion || !isSafe) return 'unsafe';
    return values.some((value) => hasYieldedReference(value, scope.yielded, source)) ? 'yielded' : 'assertion';
}

function isAssertionBody(body: TSESTree.BlockStatement, parameter: string, source: TSESLint.SourceCode): boolean {
    const scope = { kinds: new Map([[parameter, 'yielded']]), yielded: new Set([parameter]) };
    const uses = new Set(
        body.body.map((statement) => {
            if (statement.type === AST_NODE_TYPES.VariableDeclaration)
                return getDeclarationUse(statement, scope, source);
            return statement.type === AST_NODE_TYPES.ExpressionStatement
                ? getAssertionUse(statement.expression, scope, source)
                : 'unsafe';
        }),
    );
    return !uses.has('unsafe') && uses.has('yielded');
}

function getThenCall(body: TSESTree.BlockStatement): ThenCall | undefined {
    const callback = body.parent as FunctionNode;
    const { callee } = callback.parent as MemberCall;
    const [parameter] = callback.params;
    return parameter?.type === AST_NODE_TYPES.Identifier
        ? { property: callee.property, receiver: callee.object, parameter: parameter.name }
        : undefined;
}

export const noCypressThenAssertions = createRule<[], 'retry' | 'should'>({
    name: 'no-cypress-then-assertions',
    meta: {
        defaultOptions: [],
        type: 'problem',
        hasSuggestions: true,
        docs: {
            level: 'recommended',
            description:
                'Reports a `.then()` callback on a chain of Cypress DOM queries, such as `cy.get(selector)`, when the callback only asserts on the element that it receives.',
            why: 'Cypress runs a `.then()` callback once, so its assertions fail when the page has not settled yet. A `.should()` callback runs again until its assertions pass or the command times out.',
            fix: 'Replace `.then()` with `.should()`.',
            example:
                '`cy.get("li").then(($items) => { expect($items).to.have.length(3); })` reports `retry`. Write `cy.get("li").should(($items) => { expect($items).to.have.length(3); })`.',
        },
        schema: [],
        messages: {
            retry: 'Assertions in `.then()` run once; use `.should()` to retry them until the page settles.',
            should: 'Replace `.then()` with `.should()`.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        if (!isTestRelatedPath(context.filename)) return {};
        return {
            [THEN_CALLBACK](body: TSESTree.BlockStatement) {
                const then = getThenCall(body);
                const isRetried =
                    then !== undefined &&
                    isQueryChain(then.receiver, source) &&
                    isAssertionBody(body, then.parameter, source);
                if (isRetried)
                    context.report({
                        node: then.property,
                        messageId: 'retry',
                        suggest: [{ messageId: 'should', fix: (fixer) => fixer.replaceText(then.property, 'should') }],
                    });
            },
        };
    },
});
