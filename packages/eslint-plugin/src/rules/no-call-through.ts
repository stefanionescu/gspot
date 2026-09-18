// A named function that calls one other function with its own parameters unchanged and in order.
import { createRule } from '#plugin/rule.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { optionsSchema, stringList } from '#plugin/options.ts';
import type { NoCallThroughOptions } from '#plugin-types/options.ts';
import { lintedFile, lintedRoot, relativeToRoot } from '#plugin/files.ts';

const WRAPPERS = new Set([
    'AwaitExpression',
    'ChainExpression',
    'TSAsExpression',
    'TSSatisfiesExpression',
    'TSNonNullExpression',
    'TSInstantiationExpression',
]);

function unwrap(node: TSESTree.Node | null | undefined): TSESTree.Node | null | undefined {
    let current = node;
    while (current && WRAPPERS.has(current.type))
        current =
            current.type === AST_NODE_TYPES.AwaitExpression
                ? current.argument
                : (current as { expression: TSESTree.Node }).expression;
    return current;
}

function bodyExpression(statement: TSESTree.Statement): TSESTree.Node | null | undefined {
    if (statement.type === AST_NODE_TYPES.ReturnStatement) return statement.argument;
    return statement.type === AST_NODE_TYPES.ExpressionStatement ? statement.expression : undefined;
}

function onlyCall(body: TSESTree.BlockStatement): TSESTree.CallExpression | undefined {
    const [statement] = body.body;
    if (statement === undefined || body.body.length !== 1) return undefined;
    const call = unwrap(bodyExpression(statement));
    return call?.type === AST_NODE_TYPES.CallExpression ? call : undefined;
}

function parameterName(parameter: TSESTree.Parameter): string | undefined {
    const current = unwrap(parameter);
    if (current?.type === AST_NODE_TYPES.Identifier) return current.name;
    if (current?.type === AST_NODE_TYPES.AssignmentPattern && current.left.type === AST_NODE_TYPES.Identifier)
        return current.left.name;
    return undefined;
}

function forwardedCallee(node: TSESTree.FunctionDeclaration): string | undefined {
    const call = onlyCall(node.body);
    const callee = call === undefined ? undefined : unwrap(call.callee);
    if (call === undefined || callee?.type !== AST_NODE_TYPES.Identifier) return undefined;
    return isForwarding(node, call) ? callee.name : undefined;
}

function isAllowed(allow: string[], file: string | undefined, relative: string, name: string): boolean {
    return allow.some(
        (entry) => entry === `${relative}:${name}` || (file !== undefined && `${file}:${name}`.endsWith(`/${entry}`)),
    );
}

function isForwarding(node: TSESTree.FunctionDeclaration, call: TSESTree.CallExpression): boolean {
    const parameters = node.params.map((parameter) => parameterName(parameter));
    if (parameters.includes(undefined) || call.arguments.length !== parameters.length) return false;
    return call.arguments.every((argument, index) => {
        const current = unwrap(argument);
        return current?.type === AST_NODE_TYPES.Identifier && current.name === parameters[index];
    });
}

export const noCallThrough = createRule<NoCallThroughOptions, 'callThrough'>({
    name: 'no-call-through',
    meta: {
        type: 'problem',
        docs: {
            summary: 'Finds a function that passes its arguments straight through to one other function.',
            why: 'A call-through is a second name for the same work; every reader follows it to learn nothing.',
            fix: 'Call the inner function directly and delete this one, or allow it with a reason under structure.call_through_allowed when the public name is the stable contract.',
        },
        schema: [optionsSchema({ allow: stringList })],
        messages: {
            callThrough:
                '{{name}} passes its arguments straight through to {{callee}}. Call {{callee}} directly and delete {{name}}, or give it real work.',
        },
    },
    defaultOptions: [{ allow: [] }],
    create(context, [options]) {
        const allow = options.allow ?? [];
        const file = lintedFile(context);
        const relative = file === undefined ? '' : relativeToRoot(lintedRoot(context), file);
        return {
            FunctionDeclaration(node) {
                const name = node.id?.name;
                if (name === undefined || isAllowed(allow, file, relative, name)) return;
                const callee = forwardedCallee(node);
                if (callee !== undefined) context.report({ node, messageId: 'callThrough', data: { name, callee } });
            },
        };
    },
});
