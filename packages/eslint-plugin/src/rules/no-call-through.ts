// A named function that calls one other function with its own parameters unchanged and in order.
import { createRule } from '#plugin/rule.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { optionsSchema, stringList } from '#plugin/options.ts';
import type { NoCallThroughFunction } from '#plugin-types/plugin.ts';
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

function onlyCall(body: NoCallThroughFunction['body']): TSESTree.CallExpression | TSESTree.NewExpression | undefined {
    let expression: TSESTree.Node | null | undefined = body;
    if (body.type === AST_NODE_TYPES.BlockStatement) {
        const statements = body.body.filter((statement) => statement.type !== AST_NODE_TYPES.EmptyStatement);
        const [statement] = statements;
        if (statement === undefined || statements.length !== 1) return undefined;
        expression = bodyExpression(statement);
    }
    const call = unwrap(expression);
    return call?.type === AST_NODE_TYPES.CallExpression || call?.type === AST_NODE_TYPES.NewExpression
        ? call
        : undefined;
}

function forwardedName(node: TSESTree.Node): string | undefined {
    const current = unwrap(node);
    switch (current?.type) {
        case AST_NODE_TYPES.Identifier: {
            return current.name;
        }
        case AST_NODE_TYPES.RestElement:
        case AST_NODE_TYPES.SpreadElement: {
            const argument = unwrap(current.argument);
            return argument?.type === AST_NODE_TYPES.Identifier ? `...${argument.name}` : undefined;
        }
        default: {
            return undefined;
        }
    }
}

function forwardedCallee(node: NoCallThroughFunction): string | undefined {
    const call = onlyCall(node.body);
    const callee = call === undefined ? undefined : unwrap(call.callee);
    if (call === undefined || callee?.type !== AST_NODE_TYPES.Identifier) return undefined;
    return isForwarding(node, call) ? callee.name : undefined;
}

function propertyName(key: TSESTree.Node, isComputed: boolean): string | undefined {
    if (!isComputed && (key.type === AST_NODE_TYPES.Identifier || key.type === AST_NODE_TYPES.PrivateIdentifier))
        return key.name;
    return key.type === AST_NODE_TYPES.Literal && typeof key.value === 'string' ? key.value : undefined;
}

function functionName(node: NoCallThroughFunction): string | undefined {
    const parent = node.parent;
    if (parent.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier)
        return parent.id.name;
    if ('id' in node && node.id !== null) return node.id.name;
    switch (parent.type) {
        case AST_NODE_TYPES.Property:
        case AST_NODE_TYPES.MethodDefinition:
        case AST_NODE_TYPES.PropertyDefinition: {
            return propertyName(parent.key, parent.computed);
        }
        default: {
            return undefined;
        }
    }
}

function isAllowed(allow: string[], file: string | undefined, relative: string, name: string): boolean {
    return allow.some(
        (entry) => entry === `${relative}:${name}` || (file !== undefined && `${file}:${name}`.endsWith(`/${entry}`)),
    );
}

function isForwarding(node: NoCallThroughFunction, call: TSESTree.CallExpression | TSESTree.NewExpression): boolean {
    const parameters = node.params.map((parameter) => forwardedName(parameter));
    if (parameters.includes(undefined) || call.arguments.length !== parameters.length) return false;
    return call.arguments.every((argument, index) => forwardedName(argument) === parameters[index]);
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
        const inspect = (node: NoCallThroughFunction): void => {
            const name = functionName(node);
            if (name === undefined || isAllowed(allow, file, relative, name)) return;
            const callee = forwardedCallee(node);
            if (callee !== undefined) context.report({ node, messageId: 'callThrough', data: { name, callee } });
        };
        return {
            FunctionDeclaration: inspect,
            FunctionExpression: inspect,
            ArrowFunctionExpression: inspect,
        };
    },
});
