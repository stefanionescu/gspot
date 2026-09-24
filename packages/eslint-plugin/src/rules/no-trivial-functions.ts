import { createRule } from '#plugin/rules/definition.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { optionsSchema, positiveInteger } from '#plugin/rules/options.ts';

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const TYPE_ONLY = new Set(['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSDeclareFunction']);

/** Count executable statements without entering nested functions or type declarations. */
export function statementCount(node: TSESTree.Node, visitorKeys: Readonly<Record<string, readonly string[]>>): number {
    if (TYPE_ONLY.has(node.type) || ('declare' in node && node.declare === true)) return 0;
    if (FUNCTIONS.has(node.type)) return node.type === 'FunctionDeclaration' ? 1 : 0;
    const own =
        (node.type.endsWith('Statement') && node.type !== 'BlockStatement' && node.type !== 'EmptyStatement') ||
        node.type === 'VariableDeclaration' ||
        node.type === 'TSEnumDeclaration' ||
        node.type === 'ClassDeclaration'
            ? 1
            : 0;
    let count = own;
    for (const key of visitorKeys[node.type] ?? []) {
        const child = (node as unknown as Record<string, unknown>)[key];
        if (Array.isArray(child)) {
            for (const item of child) if (item !== null) count += statementCount(item as TSESTree.Node, visitorKeys);
        } else if (child !== null && typeof child === 'object')
            count += statementCount(child as TSESTree.Node, visitorKeys);
    }
    return count;
}

export const noTrivialFunctions = createRule<NoTrivialFunctionsOptions, 'trivial'>({
    name: 'no-trivial-functions',
    meta: {
        type: 'problem',
        docs: {
            title: 'Keep functions substantive',
            example:
                'The function `function one() { return 1; }` reports `trivial` at the default limit of two statements. Replace its calls with the value `1` and delete the function. Required external signatures need a narrow suppression with a reason.',
            level: 'recommended',
            summary: 'Finds every implemented function with at most the configured number of executable statements.',
            why: 'An unnecessary function adds another name and another place to read.',
            fix: 'Inline unnecessary functions. Required external APIs need a narrow suppression with a reason.',
        },
        schema: [optionsSchema({ maxStatements: positiveInteger })],
        messages: {
            trivial:
                'This function has {{count}} executable statements, at most {{max}}. Inline it or explain its required API with a narrow suppression.',
        },
    },
    defaultOptions: [{ maxStatements: 2 }],
    create(context, [options]) {
        const max = options.maxStatements ?? 2;
        return {
            ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)'(
                node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
            ) {
                if (node.body === undefined) return;
                const count =
                    node.body.type === 'BlockStatement' ? statementCount(node.body, context.sourceCode.visitorKeys) : 1;
                if (count <= max) context.report({ node, messageId: 'trivial', data: { count, max } });
            },
        };
    },
});

export type NoTrivialFunctionsOptions = [{ maxStatements?: number }];
