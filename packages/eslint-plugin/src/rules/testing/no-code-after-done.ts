import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { FUNCTION_NODES } from '../../config/plugin.ts';
import { DONE_STOP_STATEMENTS, MARKED_TEST_MODIFIERS } from '../../config/testing.ts';
import { getTestCall, listBodyNodes } from '../../libraries/testing.ts';
import { createRule } from '../../rule.ts';
import type { TestCall } from '../../types/testing.ts';

function listFollowingStatements(statement: TSESTree.Node): TSESTree.Node[] {
    const { parent } = statement;
    const isBlock = parent?.type === AST_NODE_TYPES.BlockStatement || parent?.type === AST_NODE_TYPES.Program;
    const siblings: TSESTree.Node[] = isBlock ? parent.body : [];
    return siblings.slice(siblings.indexOf(statement) + 1);
}

function findCodeAfter(call: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Node | undefined {
    const ancestors = source.getAncestors(call);
    const boundary = ancestors.findLastIndex((node) => FUNCTION_NODES.has(node.type));
    const statements = ancestors
        .slice(boundary + 1)
        .filter((node) => node.type.endsWith('Statement') && node.type !== AST_NODE_TYPES.BlockStatement)
        .toReversed();
    const following = statements.flatMap((statement) => listFollowingStatements(statement));
    for (const next of following) {
        if (DONE_STOP_STATEMENTS.has(next.type)) return undefined;
        const found = listBodyNodes(next, source).find((node) => node.type === AST_NODE_TYPES.ExpressionStatement);
        if (found !== undefined) return found;
    }
    return undefined;
}

function listDoneCalls(callback: TestCall['callback'], source: TSESLint.SourceCode): TSESTree.Node[] {
    const done = callback?.params[0];
    const variable =
        done?.type === AST_NODE_TYPES.Identifier ? ASTUtils.findVariable(source.getScope(done), done) : null;
    const identifiers = (variable?.references ?? []).map(({ identifier }) => identifier);
    return identifiers.flatMap(({ parent, range }) =>
        parent.type === AST_NODE_TYPES.CallExpression && parent.callee.range[0] === range[0] ? [parent] : [],
    );
}

export const noCodeAfterDone = createRule<[], 'afterDone'>({
    name: 'no-code-after-done',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports the first statement that runs after the `done` callback of an `it`, `specify`, or `test` case: in the same block, or after the block that holds the call.',
            why: 'The runner ends the test when `done` runs. A statement after it runs while the next test starts, so its assertions and errors land in the wrong test or nowhere.',
            fix: 'Move the code above the call of `done`, or return a promise instead of taking `done`.',
            example: '`it("saves", (done) => { save(); done(); check(); })` reports `afterDone` on `check();`.',
        },
        schema: [],
        messages: { afterDone: 'Move this code before the call to "done".' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            CallExpression(node) {
                const call = getTestCall(node, source);
                const isTest =
                    call?.kind === 'test' && call.modifiers.every((modifier) => MARKED_TEST_MODIFIERS.has(modifier));
                const calls = isTest && call.callback === node.arguments[1] ? listDoneCalls(call.callback, source) : [];
                const after = calls.map((done) => findCodeAfter(done, source)).find((each) => each !== undefined);
                if (after !== undefined) context.report({ node: after, messageId: 'afterDone' });
            },
        };
    },
});
