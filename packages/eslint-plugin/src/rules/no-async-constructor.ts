import { createRule } from '../rule.ts';
import { unwrapExpression } from '../syntax.ts';
import type { TypeReader } from '../types/plugin.ts';
import { readTypes, isThenable } from '../checker.ts';
import { CONSTRUCTOR_BODY_DEPTH } from '../config/rules.ts';
import { PROMISE_NAME, SETTLE_METHOD } from '../config/builtins.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function readConstructorStatement(ancestors: readonly TSESTree.Node[]): TSESTree.Node | undefined {
    const start = ancestors.findLastIndex(
        (ancestor) => ancestor.type === AST_NODE_TYPES.MethodDefinition && ancestor.kind === 'constructor',
    );
    const body = start === -1 ? [] : ancestors.slice(start + CONSTRUCTOR_BODY_DEPTH);
    if (body.some((ancestor) => ASTUtils.isFunction(ancestor))) return undefined;
    return body.findLast((ancestor) => ancestor.type.endsWith('Statement'));
}

function isAssignedToThis(call: TSESTree.CallExpression, statement: TSESTree.Node): boolean {
    const assignment = statement.type === AST_NODE_TYPES.ExpressionStatement ? statement.expression : undefined;
    if (assignment?.type !== AST_NODE_TYPES.AssignmentExpression || assignment.operator !== '=') return false;
    const { left, right } = assignment;
    return (
        unwrapExpression(right) === call &&
        left.type === AST_NODE_TYPES.MemberExpression &&
        left.object.type === AST_NODE_TYPES.ThisExpression
    );
}

function isLibraryPromiseSettle(call: TSESTree.CallExpression, types: TypeReader): boolean {
    const { callee } = call;
    if (
        call.arguments.length > 0 ||
        callee.type !== AST_NODE_TYPES.MemberExpression ||
        !ASTUtils.isIdentifier(callee.object) ||
        callee.object.name !== PROMISE_NAME ||
        ASTUtils.getPropertyName(callee) !== SETTLE_METHOD
    )
        return false;
    return [callee.object, callee.property].every(
        (member) =>
            types.checker
                .getSymbolAtLocation(types.map.get(member))
                ?.declarations?.every((declaration) =>
                    types.program.isSourceFileDefaultLibrary(declaration.getSourceFile()),
                ) === true,
    );
}

export const noAsyncConstructor = createRule<[], 'async'>({
    name: 'no-async-constructor',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a statement of a class constructor that calls something returning a promise. Calls inside functions that the constructor defines pass, and so does `this.ready = Promise.resolve()`. It needs type information and reports nothing without it.',
            why: 'A constructor cannot await, so the object is returned before the work finishes, and a rejection goes unhandled.',
            fix: 'Move the asynchronous work into an async factory function or an `init` method that callers await.',
            example: '`constructor() { this.load(); }` reports `async` when `load` returns a promise.',
        },
        schema: [],
        messages: { async: 'Move this asynchronous call out of the constructor, into an async factory or method.' },
    },
    create(context) {
        const types = readTypes(context);
        if (types === undefined) return {};
        const reported = new Set<TSESTree.Node>();
        return {
            CallExpression(node) {
                if (!isThenable(types, node)) return;
                const statement = readConstructorStatement(context.sourceCode.getAncestors(node));
                if (statement === undefined || reported.has(statement)) return;
                if (isAssignedToThis(node, statement) && isLibraryPromiseSettle(node, types)) return;
                reported.add(statement);
                context.report({ node: statement, messageId: 'async' });
            },
        };
    },
});
