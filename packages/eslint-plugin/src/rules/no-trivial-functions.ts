// A function with too few executable statements that only forwards its parameters to one call.
import { createRule } from '#plugin/rule.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { optionsSchema, positiveInteger } from '#plugin/options.ts';
import type { NoTrivialFunctionsFunction } from '#plugin-types/plugin.ts';
import type { NoTrivialFunctionsOptions } from '#plugin-types/options.ts';

const DEFAULT_MAX = 2;
const NAMED_PARENTS = new Set(['Property', 'MethodDefinition', 'PropertyDefinition']);

function unwrap(node: TSESTree.Node | null | undefined): TSESTree.Node | null | undefined {
    let current = node;
    for (;;) {
        if (current?.type === AST_NODE_TYPES.AwaitExpression) current = current.argument;
        else if (current?.type === AST_NODE_TYPES.ChainExpression) current = current.expression;
        else return current;
    }
}

function parameterName(parameter: TSESTree.Parameter): string | undefined {
    if (parameter.type === AST_NODE_TYPES.Identifier) return parameter.name;
    if (parameter.type === AST_NODE_TYPES.RestElement && parameter.argument.type === AST_NODE_TYPES.Identifier)
        return parameter.argument.name;
    return undefined;
}

function argumentName(argument: TSESTree.CallExpressionArgument): string | undefined {
    if (argument.type === AST_NODE_TYPES.Identifier) return argument.name;
    if (argument.type === AST_NODE_TYPES.SpreadElement && argument.argument.type === AST_NODE_TYPES.Identifier)
        return argument.argument.name;
    return undefined;
}

function callOf(
    expression: TSESTree.Node | null | undefined,
): TSESTree.CallExpression | TSESTree.NewExpression | undefined {
    const call = unwrap(expression);
    if (call?.type !== AST_NODE_TYPES.CallExpression && call?.type !== AST_NODE_TYPES.NewExpression) return undefined;
    return call.callee.type === AST_NODE_TYPES.Identifier ? call : undefined;
}

function isPassThrough(node: NoTrivialFunctionsFunction, expression: TSESTree.Node | null | undefined): boolean {
    const call = callOf(expression);
    if (!call) return false;
    const parameters = node.params.map((parameter) => parameterName(parameter));
    const argv = call.arguments.map((argument) => argumentName(argument));
    if (parameters.includes(undefined) || argv.includes(undefined)) return false;
    return parameters.length === argv.length && parameters.every((name, index) => name === argv[index]);
}

function bodyExpression(statement: TSESTree.Statement): TSESTree.Node | null | undefined {
    if (statement.type === AST_NODE_TYPES.ExpressionStatement) return statement.expression;
    return statement.type === AST_NODE_TYPES.ReturnStatement ? statement.argument : undefined;
}

function parentName(parent: TSESTree.Node | undefined): string | undefined {
    if (parent?.type === AST_NODE_TYPES.VariableDeclarator && parent.id.type === AST_NODE_TYPES.Identifier)
        return parent.id.name;
    if (
        parent !== undefined &&
        NAMED_PARENTS.has(parent.type) &&
        'key' in parent &&
        parent.key.type === AST_NODE_TYPES.Identifier
    )
        return parent.key.name;
    return undefined;
}

function nameOf(node: NoTrivialFunctionsFunction): string {
    if ('id' in node && node.id?.type === AST_NODE_TYPES.Identifier) return node.id.name;
    return parentName(node.parent) ?? '<anonymous>';
}

function calleeOf(expression: TSESTree.Node | null | undefined): string {
    const call = callOf(expression);
    return call?.callee.type === AST_NODE_TYPES.Identifier ? call.callee.name : 'the inner call';
}

export const noTrivialFunctions = createRule<NoTrivialFunctionsOptions, 'trivial'>({
    name: 'no-trivial-functions',
    meta: {
        type: 'problem',
        docs: {
            summary: 'Finds a function whose body only forwards its parameters to one other call.',
            why: 'The extra name adds a hop for the reader and nothing for the program.',
            fix: 'Call the inner function directly and delete this one, or give it real work: validation, a decision, an error to handle.',
        },
        schema: [optionsSchema({ maxStatements: positiveInteger })],
        messages: { trivial: 'Inline {{name}}: its body only forwards its parameters to {{callee}}.' },
    },
    defaultOptions: [{ maxStatements: DEFAULT_MAX }],
    create(context, [options]) {
        const max = options.maxStatements ?? DEFAULT_MAX;
        const report = (node: NoTrivialFunctionsFunction, expression: TSESTree.Node | null | undefined): void => {
            context.report({ node, messageId: 'trivial', data: { name: nameOf(node), callee: calleeOf(expression) } });
        };
        const checkBlock = (node: NoTrivialFunctionsFunction): void => {
            if (node.body.type !== AST_NODE_TYPES.BlockStatement) return;
            const statements = node.body.body.filter((statement) => statement.type !== AST_NODE_TYPES.EmptyStatement);
            const [only] = statements;
            if (only === undefined || statements.length !== 1 || statements.length > max) return;
            const expression = bodyExpression(only);
            if (isPassThrough(node, expression)) report(node, expression);
        };
        return {
            FunctionDeclaration: checkBlock,
            FunctionExpression: checkBlock,
            ArrowFunctionExpression(node) {
                if (node.body.type === AST_NODE_TYPES.BlockStatement) {
                    checkBlock(node);
                    return;
                }
                if (nameOf(node) !== '<anonymous>' && isPassThrough(node, node.body)) report(node, node.body);
            },
        };
    },
});
