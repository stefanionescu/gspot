import { createRule } from '../../rule.ts';
import { WRITING_COLLECTION_METHODS } from '../../config/collections.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { getStoredValue, listLocalVariables, listInitialElements } from '../../language/collections.ts';

function isWriteStatement(expression: TSESTree.Expression, identifier: TSESTree.Node): boolean {
    if (expression.type === AST_NODE_TYPES.AssignmentExpression)
        return (
            expression.left.type === AST_NODE_TYPES.MemberExpression && Object.is(expression.left.object, identifier)
        );
    if (expression.type !== AST_NODE_TYPES.CallExpression) return false;
    const { callee } = expression;
    return (
        callee.type === AST_NODE_TYPES.MemberExpression &&
        Object.is(callee.object, identifier) &&
        ASTUtils.isIdentifier(callee.property) &&
        WRITING_COLLECTION_METHODS.has(callee.property.name)
    );
}

function isContentRead({ identifier }: TSESLint.Scope.Reference, source: TSESLint.SourceCode): boolean {
    const statement = source
        .getAncestors(identifier)
        .findLast(({ type }) => type === AST_NODE_TYPES.ExpressionStatement);
    return (
        statement?.type !== AST_NODE_TYPES.ExpressionStatement || !isWriteStatement(statement.expression, identifier)
    );
}

function isWriteOnlyCollection(variable: TSESLint.Scope.Variable, source: TSESLint.SourceCode): boolean {
    const isExported = variable.defs.at(0)?.node.parent.parent?.type.startsWith('Export') === true;
    const writes = variable.references.filter((reference) => reference.isWriteOnly());
    const others = variable.references.filter((reference) => !reference.isWriteOnly());
    const isFilled =
        writes.length > 0 &&
        writes.every((reference) => listInitialElements(getStoredValue(reference, source)) !== undefined);
    const isRead = others.some((reference) => isContentRead(reference, source));
    return !isExported && variable.references.length > 1 && isFilled && !isRead;
}

export const noUnusedCollection = createRule<[], 'unused'>({
    name: 'no-unused-collection',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a local variable that holds an array, map, or set when the code only stores collections in it, writes its elements, or calls its writing methods, such as `push`, `set`, and `add`, and never reads its contents. Exported variables do not count.',
            why: 'Filling a collection that nothing reads costs time and memory and often means that the code forgot to use the result.',
            fix: 'Read the collection where its contents matter, or remove it and the writes to it.',
            example: '`const names = []; names.push(name);` with no other use reports `unused` at `names`.',
        },
        schema: [],
        messages: { unused: 'Nothing reads the contents of {{name}}. Use them or remove the collection.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'Program:exit'() {
                for (const variable of listLocalVariables(source)) {
                    const [identifier] = variable.identifiers;
                    if (identifier !== undefined && isWriteOnlyCollection(variable, source))
                        context.report({ node: identifier, messageId: 'unused', data: { name: identifier.name } });
                }
            },
        };
    },
});
