import type { TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import { DEFAULT_TRIVIAL_STATEMENTS } from '#plugin/config/rules.ts';
import { totalStatements, hasConstructorState } from '#plugin/syntax.ts';
import type { ContentCheck, ImplementedFunction } from '#plugin/types/rules.ts';
import { FUNCTIONS, FORWARDING_NODES, STRUCTURED_EXPRESSIONS } from '#plugin/config/plugin.ts';

// Declarations own their schemas or the implementations they contain.
function declarationContent(node: TSESTree.Node, inspect: ContentCheck): boolean | undefined {
    switch (node.type) {
        case AST_NODE_TYPES.ExportNamedDeclaration: {
            return node.declaration !== null && inspect(node.declaration);
        }
        case AST_NODE_TYPES.ClassDeclaration:
        case AST_NODE_TYPES.ClassExpression: {
            return node.body.body.some((member) => inspect(member));
        }
        case AST_NODE_TYPES.VariableDeclaration: {
            return node.declarations.some((declaration) => declaration.init !== null && inspect(declaration.init));
        }
        case AST_NODE_TYPES.TSInterfaceDeclaration: {
            return node.body.body.length > 0;
        }
        case AST_NODE_TYPES.TSTypeAliasDeclaration: {
            return node.typeAnnotation.type !== AST_NODE_TYPES.TSTypeReference;
        }
        default: {
            return undefined;
        }
    }
}

// Expression wrappers retain the content of their operand or exported value.
function expressionContent(node: TSESTree.Node, inspect: ContentCheck): boolean | undefined {
    switch (node.type) {
        case AST_NODE_TYPES.ExportDefaultDeclaration: {
            return inspect(node.declaration);
        }
        case AST_NODE_TYPES.TSAsExpression:
        case AST_NODE_TYPES.TSSatisfiesExpression:
        case AST_NODE_TYPES.TSNonNullExpression:
        case AST_NODE_TYPES.ExpressionStatement: {
            return inspect(node.expression);
        }
        case AST_NODE_TYPES.AwaitExpression: {
            return inspect(node.argument);
        }
        default: {
            return undefined;
        }
    }
}

// Calls own inline schemas and substantive arguments. Remaining syntax represents implementation.
function callContent(node: TSESTree.Node, inspect: ContentCheck): boolean {
    if (node.type !== AST_NODE_TYPES.CallExpression && node.type !== AST_NODE_TYPES.NewExpression) return true;
    if (
        node.typeArguments?.params.some(
            (parameter) => parameter.type === AST_NODE_TYPES.TSTypeLiteral && parameter.members.length > 0,
        ) === true
    )
        return true;
    if (
        node.arguments.some(
            (argument) =>
                argument.type !== AST_NODE_TYPES.Identifier &&
                argument.type !== AST_NODE_TYPES.SpreadElement &&
                inspect(argument),
        )
    )
        return true;
    return (
        node.callee.type === AST_NODE_TYPES.MemberExpression &&
        node.callee.object.type === AST_NODE_TYPES.CallExpression &&
        inspect(node.callee.object)
    );
}

// Factories own the structure they construct, including structures passed to schema builders.
function ownsStructuredValue(node: TSESTree.Node): boolean {
    if (STRUCTURED_EXPRESSIONS.has(node.type)) return true;
    switch (node.type) {
        case AST_NODE_TYPES.TemplateLiteral: {
            return node.expressions.length > 0;
        }
        case AST_NODE_TYPES.ConditionalExpression: {
            return ownsStructuredValue(node.consequent) || ownsStructuredValue(node.alternate);
        }
        case AST_NODE_TYPES.CallExpression:
        case AST_NODE_TYPES.NewExpression: {
            return callContent(node, ownsStructuredValue);
        }
        default: {
            return expressionContent(node, ownsStructuredValue) ?? false;
        }
    }
}

export const noTrivialFiles = createRule<[{ maxStatements?: number }], 'trivial'>({
    name: 'no-trivial-files',
    meta: {
        type: 'problem',
        docs: {
            title: 'Keep files substantive',
            example:
                'A file containing only `export { value } from "./owner";` reports `trivial`. Change consumers to import directly from `owner`, then delete the forwarding file. Entry filenames do not exempt forwarding code.',
            level: 'all',
            summary:
                'Finds files containing only forwarding, aliases, re-exports, or trivial functions. Owned structures, nested implementations, and type predicates remain substantive.',
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
        const max = options.maxStatements ?? DEFAULT_TRIVIAL_STATEMENTS;
        let hasImplementation = false;
        const substantial: ContentCheck = (node) => {
            if (FORWARDING_NODES.has(node.type) || FUNCTIONS.has(node.type)) return false;
            if (node.type === AST_NODE_TYPES.MethodDefinition || node.type === AST_NODE_TYPES.PropertyDefinition)
                return node.value !== null && substantial(node.value);
            return (
                declarationContent(node, substantial) ??
                expressionContent(node, substantial) ??
                callContent(node, substantial)
            );
        };
        return {
            ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)'(node: ImplementedFunction) {
                if (
                    node.returnType?.typeAnnotation.type === AST_NODE_TYPES.TSTypePredicate ||
                    hasConstructorState(node) ||
                    totalStatements(node, context.sourceCode.visitorKeys) > max ||
                    (node.body.type !== AST_NODE_TYPES.BlockStatement && ownsStructuredValue(node.body))
                )
                    hasImplementation = true;
            },
            ReturnStatement(node) {
                if (node.argument !== null && ownsStructuredValue(node.argument)) hasImplementation = true;
            },
            'Program:exit'(node) {
                if (
                    !hasImplementation &&
                    node.body.length > 0 &&
                    !node.body.some((statement) => substantial(statement))
                )
                    context.report({ node, messageId: 'trivial' });
            },
        };
    },
});
