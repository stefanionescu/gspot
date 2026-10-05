import { lintedPath, isIndexFile } from '#plugin/files.ts';
import { TRIVIAL_STATEMENTS } from '#plugin/config/syntax.ts';
import { createRule, optionsSchema } from '#plugin/definition.ts';
import type { ImplementedFunction } from '#plugin/types/syntax.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { unwrap, totalStatements, hasConstructorState } from '#plugin/syntax.ts';
import type { ContentCheck, TrivialFilesOptions } from '#plugin/types/file-content.ts';
import { FORWARDING_NODES, STRUCTURED_EXPRESSIONS } from '#plugin/config/file-content.ts';

function ownsTypeShape(annotation: TSESTree.TypeNode): boolean {
    if (annotation.type !== AST_NODE_TYPES.TSTypeReference) return true;
    const typeArguments = annotation.typeArguments;
    if (typeArguments === undefined) return false;
    return typeArguments.params.some((parameter) => parameter.type === AST_NODE_TYPES.TSTypeQuery);
}

// Declarations own their schemas or the implementations they contain.
function declarationContent(node: TSESTree.Node, inspect: ContentCheck): boolean | undefined {
    switch (node.type) {
        case AST_NODE_TYPES.ExportNamedDeclaration: {
            return inspect(node.declaration);
        }
        case AST_NODE_TYPES.ClassDeclaration:
        case AST_NODE_TYPES.ClassExpression: {
            return node.body.body.some((member) => inspect(member));
        }
        case AST_NODE_TYPES.VariableDeclaration: {
            return node.declarations.some((declaration) => inspect(declaration.init));
        }
        case AST_NODE_TYPES.TSInterfaceDeclaration: {
            return node.body.body.length > 0;
        }
        case AST_NODE_TYPES.TSTypeAliasDeclaration: {
            return ownsTypeShape(node.typeAnnotation);
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
        case AST_NODE_TYPES.ExpressionStatement: {
            return inspect(node.expression);
        }
        case AST_NODE_TYPES.MethodDefinition:
        case AST_NODE_TYPES.PropertyDefinition: {
            return inspect(node.value);
        }
        case AST_NODE_TYPES.AwaitExpression: {
            return inspect(node.argument);
        }
        default: {
            return undefined;
        }
    }
}

// Calls own inline schemas and substantive arguments.
function callContent(node: TSESTree.CallExpression | TSESTree.NewExpression, inspect: ContentCheck): boolean {
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
function ownsStructuredValue(expression: TSESTree.Node | null): boolean {
    const node = unwrap(expression);
    if (node === null) return false;
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
            return expressionContent(node, ownsStructuredValue) === true;
        }
    }
}

export const noTrivialFiles = createRule<TrivialFilesOptions, 'trivial'>({
    name: 'no-trivial-files',
    meta: {
        defaultOptions: [{ maxStatements: TRIVIAL_STATEMENTS, allowIndex: false }],
        type: 'suggestion',
        docs: {
            title: 'Remove forwarding files',
            example:
                'A file containing only `export { value } from "./owner";` reports `trivial`. Change consumers to import directly from `owner`, then delete the forwarding file. Set `allowIndex: true` to permit an index barrel.',
            level: 'all',
            description:
                'Reports files containing only forwarding, aliases, re-exports, or trivial functions. Records, arrays, schema declarations, type predicates, and functions above the statement limit are exempt.',
            why: 'A file that only forwards to another module adds a step to every import and hides where the code lives.',
            fix: 'Import re-exported values from the modules that define them. Move aliases and small functions into the modules that use them, then delete the forwarding file.',
        },
        schema: [optionsSchema({ maxStatements: { type: 'integer', minimum: 1 }, allowIndex: { type: 'boolean' } })],
        messages: {
            trivial:
                'This file has only forwarding code, aliases, or small functions. Move that code to the module that uses it and delete this file.',
        },
    },
    create(context, [options]) {
        const file = lintedPath(context);
        if (file !== undefined && options.allowIndex && isIndexFile(file.absolute)) return {};
        const max = options.maxStatements;
        let hasImplementation = false;
        const substantial: ContentCheck = (expression) => {
            const node = unwrap(expression);
            if (node === null) return false;
            if (FORWARDING_NODES.has(node.type)) return false;
            const content = declarationContent(node, substantial) ?? expressionContent(node, substantial);
            if (content !== undefined) return content;
            if (node.type !== AST_NODE_TYPES.CallExpression && node.type !== AST_NODE_TYPES.NewExpression) return true;
            return callContent(node, substantial);
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
