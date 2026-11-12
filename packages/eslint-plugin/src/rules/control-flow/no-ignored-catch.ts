import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { COMPLEX_TRY_STATEMENTS } from '../../config/control-flow.ts';
import { createRule } from '../../rule.ts';

function hasComplexTryBody(node: TSESTree.CatchClause): boolean {
    const [first, ...remaining] = node.parent.block.body;
    if (first === undefined || remaining.length > 0) return true;
    let statement = first;
    while (statement.type === AST_NODE_TYPES.LabeledStatement) statement = statement.body;
    return COMPLEX_TRY_STATEMENTS.test(statement.type);
}

function hasUnusedParameter(node: TSESTree.CatchClause, source: TSESLint.SourceCode): boolean {
    if (node.param === null) return true;
    if (node.param.type !== AST_NODE_TYPES.Identifier) return false;
    return ASTUtils.findVariable(source.getScope(node), node.param)?.references.length === 0;
}

export const noIgnoredCatch = createRule<[], 'exception'>({
    name: 'no-ignored-catch',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports ignored or omitted catch parameters around multiple statements, blocks, loops, or switches.',
            why: 'Discarding exceptions from a larger operation can hide which step failed and leave incomplete work.',
            fix: 'Handle or rethrow the exception, narrow the try body, or document why an empty catch intentionally ignores it.',
            example: '`catch (error) { report(error); }` handles the caught exception.',
        },
        schema: [],
        messages: {
            exception: 'Handle this exception, narrow the try body, or explain why an empty catch ignores it.',
        },
    },
    create(context) {
        return {
            CatchClause: (node) => {
                if (!hasUnusedParameter(node, context.sourceCode) || !hasComplexTryBody(node)) return;
                if (
                    node.body.body.length === 0 &&
                    context.sourceCode.getCommentsInside(node.body).some((comment) => comment.value.trim().length > 0)
                )
                    return;
                context.report({ node, messageId: 'exception' });
            },
        };
    },
});
