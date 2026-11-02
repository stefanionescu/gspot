import { createRule } from '../rule.ts';
import { listBodyNodes, isTestRelatedPath } from '../testing.ts';
import type { ThenCall, MemberCall, FunctionNode, CallbackScope } from '../types/rules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    STRING_CALLS,
    LITERAL_KINDS,
    SELECTOR_TEXT,
    THEN_CALLBACK,
    SAFE_OPERANDS,
    CYPRESS_QUERIES,
    ASSERTION_DEPTHS,
} from '../config/cypress.ts';

function readCallKind(node: TSESTree.CallExpression, kinds: ReadonlyMap<string, string>): string | undefined {
    const { callee } = node;
    if (callee.type !== AST_NODE_TYPES.MemberExpression || node.arguments.length > 0) return undefined;
    const name = [readSafeKind(callee.object, kinds), ASTUtils.getPropertyName(callee)].join('.');
    return STRING_CALLS.has(name) ? 'string' : undefined;
}

function readLeafKind(node: TSESTree.Node, kinds: ReadonlyMap<string, string>): string | undefined {
    if (node.type === AST_NODE_TYPES.Identifier) return kinds.get(node.name);
    if (node.type === AST_NODE_TYPES.CallExpression) return readCallKind(node, kinds);
    const isRecordMember =
        node.type === AST_NODE_TYPES.MemberExpression &&
        !node.computed &&
        readSafeKind(node.object, kinds) === 'record';
    if (isRecordMember) return 'value';
    return node.type === AST_NODE_TYPES.Literal ? LITERAL_KINDS.get(typeof node.value) : undefined;
}

function readSafeKind(node: TSESTree.Node, kinds: ReadonlyMap<string, string>): string | undefined {
    const [kind, ...fields] = SAFE_OPERANDS.get(node.type) ?? [];
    if (kind === undefined) return readLeafKind(node, kinds);
    const operands = fields
        .flatMap((field): unknown => node[field as keyof TSESTree.Node])
        .filter((value): value is TSESTree.Node => value !== null && typeof value === 'object');
    return operands.every((operand) => readSafeKind(operand, kinds) !== undefined) ? kind : undefined;
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
    isSelector: boolean,
    source: TSESLint.SourceCode,
): boolean {
    const isText = argument.type === AST_NODE_TYPES.Literal || argument.type === AST_NODE_TYPES.TemplateLiteral;
    const isSelectorText = isText && SELECTOR_TEXT.test(source.getText(argument));
    return isSelector ? isSelectorText : readSafeKind(argument, new Map()) !== undefined;
}

function isRetriedQuery(node: TSESTree.CallExpression, source: TSESLint.SourceCode): boolean {
    const { callee } = node;
    const method = callee.type === AST_NODE_TYPES.MemberExpression ? ASTUtils.getPropertyName(callee) : null;
    return (
        CYPRESS_QUERIES.has(method) &&
        node.arguments.every((value, index) => isSafeArgument(value, method === 'get' && index === 0, source))
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

function usesYielded(node: TSESTree.Node, yielded: ReadonlySet<string>, source: TSESLint.SourceCode): boolean {
    const names = listBodyNodes(node, source).filter(
        (value): value is TSESTree.Identifier => value.type === AST_NODE_TYPES.Identifier,
    );
    const references = names.filter((name) => isReference(name));
    return references.some((name) => yielded.has(name.name));
}

function acceptDeclaration(
    statement: TSESTree.VariableDeclaration,
    scope: CallbackScope,
    source: TSESLint.SourceCode,
): boolean {
    const declarations = statement.kind === 'const' ? statement.declarations : [];
    for (const { id, init } of declarations) {
        const kind = init && readSafeKind(init, scope.kinds);
        if (init === null || typeof kind !== 'string' || id.type !== AST_NODE_TYPES.Identifier) return false;
        scope.kinds.set(id.name, kind);
        if (usesYielded(init, scope.yielded, source)) scope.yielded.add(id.name);
    }
    return declarations.length > 0;
}

function readAssertionUse(expression: TSESTree.Expression, scope: CallbackScope, source: TSESLint.SourceCode): string {
    const chain = listChain(expression);
    const calls = chain.filter(
        (value): value is TSESTree.CallExpression => value.type === AST_NODE_TYPES.CallExpression,
    );
    const values = calls.flatMap((call) => call.arguments);
    const isAssertion = [...ASSERTION_DEPTHS].some(
        ([name, depth]) => chain.length >= depth && isGlobalName(chain.at(-1), name, source),
    );
    const isSafe = values.every(
        (value) => value.type !== AST_NODE_TYPES.SpreadElement && readSafeKind(value, scope.kinds) !== undefined,
    );
    if (!isAssertion || !isSafe) return 'unsafe';
    return values.some((value) => usesYielded(value, scope.yielded, source)) ? 'yielded' : 'assertion';
}

function isAssertionBody(body: TSESTree.BlockStatement, parameter: string, source: TSESLint.SourceCode): boolean {
    const scope = { kinds: new Map([[parameter, 'yielded']]), yielded: new Set([parameter]) };
    const uses = new Set(
        body.body.map((statement) => {
            if (statement.type === AST_NODE_TYPES.VariableDeclaration)
                return acceptDeclaration(statement, scope, source) ? 'declaration' : 'unsafe';
            return statement.type === AST_NODE_TYPES.ExpressionStatement
                ? readAssertionUse(statement.expression, scope, source)
                : 'unsafe';
        }),
    );
    return !uses.has('unsafe') && uses.has('yielded');
}

function readThenCall(body: TSESTree.BlockStatement): ThenCall | undefined {
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
                'Reports a `.then()` callback on a chain of Cypress DOM queries, such as `cy.get(selector).find(child)`, when the callback only asserts with the global `expect` or `assert` on the element it receives, through constants and values it reads from that element. It reads files whose name marks them as tests, such as `.cy.ts` files.',
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
        if (!isTestRelatedPath(context.filename, context.settings['testFileExtensions'])) return {};
        return {
            [THEN_CALLBACK](body: TSESTree.BlockStatement) {
                const then = readThenCall(body);
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
