import { statementCount } from '#plugin/statements.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { createRule, optionsSchema } from '#plugin/definition.ts';

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
        schema: [optionsSchema({ maxStatements: { type: 'integer', minimum: 1 } })],
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
