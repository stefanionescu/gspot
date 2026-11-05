import { AST_NODE_TYPES, TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { ELEMENT_WRITE_OPERATORS, READING_COLLECTION_METHODS } from '../../config/collections.ts';
import { getStoredValue, listInitialElements, listLocalVariables } from '../../language/collections.ts';
import { createRule } from '../../rule.ts';

function isElementWrite(member: TSESTree.MemberExpression, source: TSESLint.SourceCode): boolean {
    const chain = [...source.getAncestors(member), member];
    const index = chain.findLastIndex(({ type }) => type === AST_NODE_TYPES.AssignmentExpression);
    const assignment = chain[index];
    return (
        assignment?.type === AST_NODE_TYPES.AssignmentExpression &&
        ELEMENT_WRITE_OPERATORS.has(assignment.operator) &&
        chain.slice(index + 1).includes(assignment.left)
    );
}

function isMemberRead(member: TSESTree.MemberExpression, source: TSESLint.SourceCode): boolean {
    const { property } = member;
    const isMethod = property.type === AST_NODE_TYPES.Identifier && READING_COLLECTION_METHODS.has(property.name);
    return (
        (isMethod && member.parent.type === AST_NODE_TYPES.CallExpression) ||
        (member.computed && !isElementWrite(member, source))
    );
}

function isCollectionRead({ identifier }: TSESLint.Scope.Reference, source: TSESLint.SourceCode): boolean {
    const { parent } = identifier;
    if (parent.type === AST_NODE_TYPES.MemberExpression && isMemberRead(parent, source)) return true;
    const loop = source
        .getAncestors(identifier)
        .findLast(({ type }) => type === AST_NODE_TYPES.ForOfStatement || type === AST_NODE_TYPES.ForInStatement);
    return loop !== undefined && 'right' in loop && Object.is(loop.right, identifier);
}

function listEmptyReads(variable: TSESLint.Scope.Variable, source: TSESLint.SourceCode): TSESLint.Scope.Reference[] {
    const isPassedIn = variable.defs.some(
        ({ type }) =>
            type === TSESLint.Scope.DefinitionType.Parameter || type === TSESLint.Scope.DefinitionType.ImportBinding,
    );
    const writes = variable.references.filter((reference) => reference.isWriteOnly());
    const reads = variable.references.filter((reference) => !reference.isWriteOnly());
    const isEmptied =
        writes.length > 0 &&
        writes.every((reference) => listInitialElements(getStoredValue(reference, source))?.length === 0);
    const isOnlyRead = reads.every((reference) => isCollectionRead(reference, source));
    return !isPassedIn && isEmptied && isOnlyRead && variable.references.length > 1 ? reads : [];
}

export const noEmptyCollection = createRule<[], 'empty'>({
    name: 'no-empty-collection',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Reports a read of a local array, map, or set that every write leaves empty.',
            why: 'A collection that nothing fills stays empty, so each read of it returns nothing and the code around it does no work.',
            fix: 'Fill the collection before the reads, or remove the collection and the code that reads it.',
            example:
                '`const names = []; for (const name of names) print(name);` reports `empty` at `names` in the loop.',
        },
        schema: [],
        messages: { empty: 'Nothing fills {{name}}, so this read always sees an empty collection.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'Program:exit'() {
                for (const variable of listLocalVariables(source))
                    for (const { identifier } of listEmptyReads(variable, source))
                        context.report({ node: identifier, messageId: 'empty', data: { name: identifier.name } });
            },
        };
    },
});
