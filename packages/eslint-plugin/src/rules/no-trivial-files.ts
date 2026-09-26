import { statementCount } from '#plugin/statements.ts';
import type { TSESTree } from '@typescript-eslint/utils';
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
                case 'ImportDeclaration':
                case 'ExportAllDeclaration':
                case 'EmptyStatement': {
                    return false;
                }
                case 'ExportNamedDeclaration': {
                    return node.declaration !== null && substantial(node.declaration);
                }
                case 'ExportDefaultDeclaration': {
                    return substantial(node.declaration);
                }
                case 'FunctionDeclaration':
                case 'FunctionExpression':
                case 'ArrowFunctionExpression': {
                    return (
                        node.body?.type === 'BlockStatement' &&
                        statementCount(node.body, context.sourceCode.visitorKeys) > max
                    );
                }
                case 'ClassDeclaration':
                case 'ClassExpression': {
                    return node.body.body.some(substantial);
                }
                case 'MethodDefinition':
                case 'PropertyDefinition': {
                    return node.value !== null && substantial(node.value);
                }
                case 'VariableDeclaration': {
                    return node.declarations.some(
                        (declaration) => declaration.init !== null && substantial(declaration.init),
                    );
                }
                case 'Identifier':
                case 'MemberExpression': {
                    return false;
                }
                case 'TSAsExpression':
                case 'TSSatisfiesExpression':
                case 'TSNonNullExpression': {
                    return substantial(node.expression);
                }
                case 'ExpressionStatement': {
                    return substantial(node.expression);
                }
                case 'AwaitExpression': {
                    return substantial(node.argument);
                }
                case 'CallExpression':
                case 'NewExpression': {
                    return (
                        node.typeArguments?.params.some(
                            (parameter) => parameter.type === 'TSTypeLiteral' && parameter.members.length > 0,
                        ) === true ||
                        node.arguments.some(
                            (argument) =>
                                argument.type !== 'Identifier' &&
                                argument.type !== 'SpreadElement' &&
                                substantial(argument),
                        ) ||
                        (node.callee.type === 'MemberExpression' &&
                            node.callee.object.type === 'CallExpression' &&
                            substantial(node.callee.object))
                    );
                }
                case 'TSInterfaceDeclaration': {
                    return node.body.body.length > 0;
                }
                case 'TSTypeAliasDeclaration': {
                    return node.typeAnnotation.type !== 'TSTypeReference';
                }
                case 'TSDeclareFunction': {
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
