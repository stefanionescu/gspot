import { statementCount } from '#plugin/statements.ts';
import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule, optionsSchema } from '#plugin/definition.ts';

export const noTrivialFiles = createRule<[{ maxStatements?: number }], 'trivial'>({
    name: 'no-trivial-files',
    meta: {
        type: 'problem',
        docs: {
            title: 'Keep files substantive',
            example:
                'A file containing only `export { value } from "./owner";` reports `trivial`. Change consumers to import directly from `owner`, then delete the forwarding file. Entry filenames do not exempt forwarding code.',
            level: 'recommended',
            summary: 'Finds files containing only forwarding, aliases, re-exports, or trivial functions.',
            why: 'A file needs substantial behavior or a meaningful owned schema.',
            fix: 'Move unnecessary wrappers and aliases to their owner. Keep substantial implementations and schemas together.',
        },
        schema: [optionsSchema({ maxStatements: { type: 'integer', minimum: 1 } })],
        messages: {
            trivial:
                'This file contains only forwarding, aliases, re-exports, or trivial functions. Move them to their owner.',
        },
    },
    defaultOptions: [{ maxStatements: 2 }],
    create(context, [options]) {
        const max = options.maxStatements ?? 2;
        const substantial = (node: TSESTree.Node): boolean => {
            switch (node.type) {
                case AST_NODE_TYPES.ImportDeclaration:
                case AST_NODE_TYPES.ExportAllDeclaration:
                case AST_NODE_TYPES.EmptyStatement: {
                    return false;
                }
                case AST_NODE_TYPES.ExportNamedDeclaration: {
                    return node.declaration !== null && substantial(node.declaration);
                }
                case AST_NODE_TYPES.ExportDefaultDeclaration: {
                    return substantial(node.declaration);
                }
                case AST_NODE_TYPES.FunctionDeclaration:
                case AST_NODE_TYPES.FunctionExpression:
                case AST_NODE_TYPES.ArrowFunctionExpression: {
                    return (
                        node.body.type === AST_NODE_TYPES.BlockStatement &&
                        statementCount(node.body, context.sourceCode.visitorKeys) > max
                    );
                }
                case AST_NODE_TYPES.ClassDeclaration:
                case AST_NODE_TYPES.ClassExpression: {
                    return node.body.body.some(substantial);
                }
                case AST_NODE_TYPES.MethodDefinition:
                case AST_NODE_TYPES.PropertyDefinition: {
                    return node.value !== null && substantial(node.value);
                }
                case AST_NODE_TYPES.VariableDeclaration: {
                    return node.declarations.some(
                        (declaration) => declaration.init !== null && substantial(declaration.init),
                    );
                }
                case AST_NODE_TYPES.Identifier:
                case AST_NODE_TYPES.MemberExpression: {
                    return false;
                }
                case AST_NODE_TYPES.TSAsExpression:
                case AST_NODE_TYPES.TSSatisfiesExpression:
                case AST_NODE_TYPES.TSNonNullExpression: {
                    return substantial(node.expression);
                }
                case AST_NODE_TYPES.ExpressionStatement: {
                    return substantial(node.expression);
                }
                case AST_NODE_TYPES.AwaitExpression: {
                    return substantial(node.argument);
                }
                case AST_NODE_TYPES.CallExpression:
                case AST_NODE_TYPES.NewExpression: {
                    return (
                        node.typeArguments?.params.some(
                            (parameter) =>
                                parameter.type === AST_NODE_TYPES.TSTypeLiteral && parameter.members.length > 0,
                        ) === true ||
                        node.arguments.some(
                            (argument) =>
                                argument.type !== AST_NODE_TYPES.Identifier &&
                                argument.type !== AST_NODE_TYPES.SpreadElement &&
                                substantial(argument),
                        ) ||
                        (node.callee.type === AST_NODE_TYPES.MemberExpression &&
                            node.callee.object.type === AST_NODE_TYPES.CallExpression &&
                            substantial(node.callee.object))
                    );
                }
                case AST_NODE_TYPES.TSInterfaceDeclaration: {
                    return node.body.body.length > 0;
                }
                case AST_NODE_TYPES.TSTypeAliasDeclaration: {
                    return node.typeAnnotation.type !== AST_NODE_TYPES.TSTypeReference;
                }
                case AST_NODE_TYPES.TSDeclareFunction: {
                    return false;
                }
                default: {
                    return true;
                }
            }
        };
        return {
            Program(node) {
                if (node.body.length > 0 && !node.body.some(substantial))
                    context.report({ node, messageId: 'trivial' });
            },
        };
    },
});
