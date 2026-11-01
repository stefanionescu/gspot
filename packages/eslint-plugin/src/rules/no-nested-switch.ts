import { createRule } from '../rule.ts';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';

export const noNestedSwitch = createRule<[], 'nested'>({
    name: 'no-nested-switch',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description: 'Reports a switch inside another switch, including nested function declarations.',
            why: 'Nested switch statements make a reader follow two sets of cases at once.',
            fix: 'Move the inner decision into a separate function declared outside the outer switch.',
            example:
                '`switch (kind) { case "file": switch (format) { case "text": readText(); } }` reports the inner switch. Call a function that selects the reader for the format instead.',
        },
        schema: [],
        messages: { nested: 'Move this nested switch into a function that names its decision.' },
    },
    create(context) {
        return {
            SwitchStatement(node) {
                for (const ancestor of context.sourceCode.getAncestors(node).toReversed()) {
                    if (ancestor.type === AST_NODE_TYPES.SwitchStatement) {
                        context.report({ node, messageId: 'nested' });
                        return;
                    }
                }
            },
        };
    },
});
