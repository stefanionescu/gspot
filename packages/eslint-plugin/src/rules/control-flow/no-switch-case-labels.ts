import { AST_NODE_TYPES } from '@typescript-eslint/utils';

import { LABEL_OWNERS } from '../../config/control-flow.ts';
import { createRule } from '../../rule.ts';

export const noSwitchCaseLabels = createRule<[], 'label'>({
    name: 'no-switch-case-labels',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Reports statement labels inside switch cases, up to an ordinary function boundary.',
            why: 'A statement label can look like another case and hide which statements the switch executes.',
            fix: 'Remove the label, or write a separate case clause when it represents another switch value.',
            example: '`switch (value) { case 1: retry: while (ready) run(); }` reports the retry label.',
        },
        schema: [],
        messages: { label: 'Remove this statement label from the switch case, or write a separate case clause.' },
    },
    create(context) {
        return {
            LabeledStatement(node) {
                const owner = context.sourceCode
                    .getAncestors(node)
                    .findLast((ancestor) => LABEL_OWNERS.has(ancestor.type));
                if (owner?.type !== AST_NODE_TYPES.SwitchCase) return;
                context.report({ node: node.label, messageId: 'label' });
            },
        };
    },
});
