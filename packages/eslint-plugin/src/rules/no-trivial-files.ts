import { posix } from 'node:path';
import { INDEX_BASENAMES } from '../config/paths.ts';
import { createRule } from '../schemas/rules/options.ts';
import type { TrivialFilesOptions } from '../types/rules.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { trivialFilesOptionsSchema } from '../schemas/rules/no/trivial.ts';
import type { ContentCheck, ImplementedFunction } from '../types/syntax.ts';

import {
    unwrap,
    hasCalculation,
    countStatements,
    getTypeServices,
    isExportedFunction,
    findZodSchemaConstructors,
} from '../syntax.ts';
import {
    SHEBANG,
    FUNCTIONS,
    FORWARDED_VALUES,
    FORWARDING_NODES,
    FUNCTION_SELECTOR,
    TRIVIAL_STATEMENTS,
    MODULE_CALL_SELECTOR,
    STRUCTURED_EXPRESSIONS,
} from '../config/syntax.ts';

/**
 * Check whether a constructor sets instance state through parameter properties or `this` assignments.
 *
 * @param node the function to check
 * @returns whether the constructor sets instance state
 */
function hasConstructorState(node: ImplementedFunction): boolean {
    if (node.parent.type !== AST_NODE_TYPES.MethodDefinition || node.parent.kind !== 'constructor') return false;
    if (node.params.some((parameter) => parameter.type === AST_NODE_TYPES.TSParameterProperty)) return true;
    if (node.body.type !== AST_NODE_TYPES.BlockStatement) return false;
    return node.body.body.some(
        (statement) =>
            statement.type === AST_NODE_TYPES.ExpressionStatement &&
            statement.expression.type === AST_NODE_TYPES.AssignmentExpression &&
            statement.expression.left.type === AST_NODE_TYPES.MemberExpression &&
            statement.expression.left.object.type === AST_NODE_TYPES.ThisExpression,
    );
}

function hasOwnTypeShape(annotation: TSESTree.TypeNode): boolean {
    if (annotation.type !== AST_NODE_TYPES.TSTypeReference) return true;
    const typeArguments = annotation.typeArguments;
    if (typeArguments === undefined) return false;
    return typeArguments.params.some((parameter) => parameter.type === AST_NODE_TYPES.TSTypeQuery);
}

// A declaration counts as content when its schema, body, or wrapped expression does.
function hasDeclarationContent(node: TSESTree.Node, inspect: ContentCheck): boolean | undefined {
    switch (node.type) {
        case AST_NODE_TYPES.ExportNamedDeclaration: {
            return inspect(node.declaration);
        }
        case AST_NODE_TYPES.ClassDeclaration:
        case AST_NODE_TYPES.ClassExpression: {
            return node.body.body.some((member) => inspect(member));
        }
        case AST_NODE_TYPES.VariableDeclaration: {
            return node.declarations.some(
                (declaration) =>
                    inspect(declaration.init) ||
                    (node.declare &&
                        declaration.id.typeAnnotation !== undefined &&
                        hasOwnTypeShape(declaration.id.typeAnnotation.typeAnnotation)),
            );
        }
        case AST_NODE_TYPES.TSInterfaceDeclaration: {
            return node.body.body.length > 0;
        }
        case AST_NODE_TYPES.TSTypeAliasDeclaration: {
            return hasOwnTypeShape(node.typeAnnotation);
        }
        default: {
            return hasOperandContent(node, inspect);
        }
    }
}

// A wrapper counts as content when its operand or exported value does.
function hasOperandContent(node: TSESTree.Node, inspect: ContentCheck): boolean | undefined {
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

// A call counts as content through an inline type or a substantive argument.
function hasCallContent(node: TSESTree.CallExpression | TSESTree.NewExpression, inspect: ContentCheck): boolean {
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

// The value that a function body returns, when the body holds one return or one expression statement: null for an
// empty body, and undefined for any other body.
function getSingleValue(node: ImplementedFunction): TSESTree.Node | null | undefined {
    if (node.body.type !== AST_NODE_TYPES.BlockStatement) return node.body;
    const [statement, ...rest] = node.body.body;
    if (statement === undefined) return null;
    if (rest.length > 0) return undefined;
    if (statement.type === AST_NODE_TYPES.ReturnStatement) return statement.argument;
    return statement.type === AST_NODE_TYPES.ExpressionStatement ? statement.expression : undefined;
}

// An exported function that only forwards returns a constant, another value or its member, or a call that passes on its
// own parameters unchanged. An exported function that does more counts as the content of its file.
function isForwarding(node: ImplementedFunction): boolean {
    const single = getSingleValue(node);
    if (single === undefined) return false;
    const value = unwrap(single);
    if (value === null) return true;
    if (FORWARDED_VALUES.has(value.type)) return true;
    if (value.type === AST_NODE_TYPES.TemplateLiteral) return value.expressions.length === 0;
    if (value.type !== AST_NODE_TYPES.CallExpression && value.type !== AST_NODE_TYPES.NewExpression) return false;
    const parameters = new Set(
        node.params.flatMap((parameter) => (parameter.type === AST_NODE_TYPES.Identifier ? [parameter.name] : [])),
    );
    return value.arguments.every(
        (argument) => argument.type === AST_NODE_TYPES.Identifier && parameters.has(argument.name),
    );
}

// A built structure counts as content, also inside a call to a schema builder.
function hasStructuredValue(expression: TSESTree.Node | null): boolean {
    const node = unwrap(expression);
    if (node === null) return false;
    if (STRUCTURED_EXPRESSIONS.has(node.type)) return true;
    switch (node.type) {
        case AST_NODE_TYPES.TemplateLiteral: {
            return node.expressions.length > 0;
        }
        case AST_NODE_TYPES.ConditionalExpression: {
            return hasStructuredValue(node.consequent) || hasStructuredValue(node.alternate);
        }
        case AST_NODE_TYPES.CallExpression:
        case AST_NODE_TYPES.NewExpression: {
            return hasCallContent(node, hasStructuredValue);
        }
        default: {
            return hasOperandContent(node, hasStructuredValue) === true;
        }
    }
}

function hasSignatureContent(node: ImplementedFunction): boolean {
    if (node.returnType?.typeAnnotation.type === AST_NODE_TYPES.TSTypePredicate || hasConstructorState(node))
        return true;
    return node.body.type !== AST_NODE_TYPES.BlockStatement && hasStructuredValue(node.body);
}

export const noTrivialFiles = createRule<TrivialFilesOptions, 'trivial'>({
    name: 'no-trivial-files',
    meta: {
        defaultOptions: [{ trivialStatements: TRIVIAL_STATEMENTS, allowIndex: false }],
        type: 'suggestion',
        docs: {
            example:
                'A file containing only `export { value } from "./owner";` reports `trivial`. Change consumers to import directly from `owner`, then delete the forwarding file. Set `allowIndex: true` to permit an index barrel.',
            level: 'all',
            description:
                'Reports files containing only forwarding, aliases, re-exports, or trivial functions. Records, arrays, schema declarations, type predicates, functions above the statement limit, and exported functions that do more than forward are exempt.',
            why: 'A file that only forwards to another module adds a step to every import and hides where the code lives.',
            fix: 'Import re-exported values from the modules that define them. Move aliases and small functions into the modules that use them, then delete the forwarding file.',
        },
        schema: [trivialFilesOptionsSchema],
        messages: {
            trivial:
                'This file only forwards or renames code. Import from the module that defines it, and delete this file.',
        },
    },
    create(context, [options]) {
        if (context.sourceCode.text.startsWith(SHEBANG)) return {};
        if (options.allowIndex && INDEX_BASENAMES.has(posix.basename(context.physicalFilename.replaceAll('\\', '/'))))
            return {};
        const max = options.trivialStatements;
        let hasImplementation = findZodSchemaConstructors(context.sourceCode).length > 0;
        const isSubstantial: ContentCheck = (expression) => {
            const node = unwrap(expression);
            if (node === null) return false;
            if (hasCalculation(node, context.sourceCode.visitorKeys)) return true;
            if (FORWARDING_NODES.has(node.type)) return false;
            const content = hasDeclarationContent(node, isSubstantial);
            if (content !== undefined) return content;
            if (node.type !== AST_NODE_TYPES.CallExpression && node.type !== AST_NODE_TYPES.NewExpression) return true;
            return hasCallContent(node, isSubstantial);
        };
        return {
            [MODULE_CALL_SELECTOR](node: TSESTree.CallExpression) {
                if (node.arguments.some((argument) => FUNCTIONS.has(argument.type))) {
                    hasImplementation = true;
                    return;
                }
                const services = getTypeServices(context.sourceCode);
                if (services === undefined) return;
                const { checker, mapping } = services;
                hasImplementation ||= node.arguments.some((argument) => {
                    if (argument.type === AST_NODE_TYPES.SpreadElement) return false;
                    const type = checker.getTypeAtLocation(mapping.get(argument));
                    return checker.isArrayType(type) || checker.isTupleType(type);
                });
            },
            [FUNCTION_SELECTOR](node: ImplementedFunction) {
                if (
                    (isExportedFunction(node, context.sourceCode) && !isForwarding(node)) ||
                    hasSignatureContent(node) ||
                    hasCalculation(node.body, context.sourceCode.visitorKeys) ||
                    countStatements(node, context.sourceCode.visitorKeys) > max
                )
                    hasImplementation = true;
            },
            ReturnStatement(node) {
                if (
                    node.argument !== null &&
                    (hasStructuredValue(node.argument) || hasCalculation(node.argument, context.sourceCode.visitorKeys))
                )
                    hasImplementation = true;
            },
            'Program:exit'(node) {
                if (
                    !hasImplementation &&
                    node.body.some((statement) => statement.type !== AST_NODE_TYPES.EmptyStatement) &&
                    !node.body.some((statement) => isSubstantial(statement))
                )
                    context.report({ node, messageId: 'trivial' });
            },
        };
    },
});
