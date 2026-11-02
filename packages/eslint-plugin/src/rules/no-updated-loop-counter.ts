import { createRule } from '../rule.ts';
import { SPLICE_METHOD } from '../config/builtins.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function listCounters(update: TSESTree.Node): TSESTree.Identifier[] {
    if (update.type === AST_NODE_TYPES.SequenceExpression)
        return update.expressions.flatMap((expression) => listCounters(expression));
    let counter: TSESTree.Node | undefined;
    if (update.type === AST_NODE_TYPES.AssignmentExpression) counter = update.left;
    else if (update.type === AST_NODE_TYPES.UpdateExpression) counter = update.argument;
    return counter?.type === AST_NODE_TYPES.Identifier ? [counter] : [];
}

function isInLoopUpdate(identifier: TSESTree.Node, ancestors: readonly TSESTree.Node[]): boolean {
    const chain = [...ancestors, identifier];
    return chain.some(
        (node, index) => node.type === AST_NODE_TYPES.ForStatement && Object.is(node.update, chain[index + 1]),
    );
}

function readStatementCall(statement: TSESTree.Statement): TSESTree.Node | null | undefined {
    if (statement.type === AST_NODE_TYPES.VariableDeclaration) return statement.declarations.at(0)?.init;
    if (statement.type !== AST_NODE_TYPES.ExpressionStatement) return undefined;
    const { expression } = statement;
    return expression.type === AST_NODE_TYPES.AssignmentExpression ? expression.right : expression;
}

function isSpliceOf(node: TSESTree.Node | null | undefined, name: string): boolean {
    if (node?.type !== AST_NODE_TYPES.CallExpression || node.callee.type !== AST_NODE_TYPES.MemberExpression)
        return false;
    const [first] = node.arguments;
    return (
        ASTUtils.getPropertyName(node.callee) === SPLICE_METHOD && ASTUtils.isIdentifier(first) && first.name === name
    );
}

function isSkipAhead(identifier: TSESTree.Identifier, ancestors: readonly TSESTree.Node[]): boolean {
    const { parent } = identifier;
    if (isInLoopUpdate(identifier, ancestors)) return false;
    if (parent.type === AST_NODE_TYPES.UpdateExpression) return true;
    if (parent.type !== AST_NODE_TYPES.AssignmentExpression) return false;
    const block = ancestors.findLast((ancestor) => ancestor.type === AST_NODE_TYPES.BlockStatement);
    return (
        parent.operator !== '=' ||
        block?.body.some((statement) => isSpliceOf(readStatementCall(statement), identifier.name)) === true
    );
}

function listBodyWrites(loop: TSESTree.ForStatement, source: TSESLint.SourceCode): TSESTree.Identifier[] {
    const { body, update } = loop;
    if (update === null || body.type !== AST_NODE_TYPES.BlockStatement) return [];
    const [bodyStart, bodyEnd] = body.range;
    return listCounters(update).flatMap((counter) => {
        const references = ASTUtils.findVariable(source.getScope(loop), counter.name)?.references ?? [];
        return references.flatMap(({ identifier }, index) => {
            const isInBody = identifier.range[0] > bodyStart && identifier.range[1] < bodyEnd;
            const isWrite = references[index]?.isWrite() === true;
            return isInBody && isWrite && ASTUtils.isIdentifier(identifier) ? [identifier] : [];
        });
    });
}

export const noUpdatedLoopCounter = createRule<[], 'counter'>({
    name: 'no-updated-loop-counter',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a plain assignment to a for loop counter inside the loop body, and an update of the counter in the update clause of a nested loop. `++`, `--`, compound assignments, and an assignment beside a `splice` call with the counter pass, because they skip or revisit items on purpose.',
            why: 'Setting the counter inside the body hides how the loop advances, and often makes it skip items or never stop.',
            fix: 'Change the counter only in the update clause, or use a while loop when the body decides how far to move.',
            example: '`for (let index = 0; index < size; index++) { index = next(index); }` reports `counter`.',
        },
        schema: [],
        messages: { counter: 'Do not assign the loop counter {{name}} in the body. Change it in the update clause.' },
    },
    create(context) {
        return {
            ForStatement(loop) {
                const source = context.sourceCode;
                for (const identifier of listBodyWrites(loop, source)) {
                    const ancestors = source.getAncestors(identifier);
                    const nested = ancestors.slice(ancestors.indexOf(loop.body));
                    if (!isSkipAhead(identifier, nested))
                        context.report({ node: identifier, messageId: 'counter', data: { name: identifier.name } });
                }
            },
        };
    },
});
