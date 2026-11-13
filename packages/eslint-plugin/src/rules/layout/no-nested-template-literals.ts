import { AST_NODE_TYPES } from '@typescript-eslint/utils';

import { createRule } from '../../rule.ts';

export const noNestedTemplateLiterals = createRule<[], 'template'>({
    name: 'no-nested-template-literals',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description: 'Reports nested templates sharing the opening or closing line of their enclosing template.',
            why: 'Several template delimiters on one line make interpolation boundaries difficult to follow.',
            fix: 'Name the inner text before interpolating it, or place multiline templates on separate lines.',
            example: `\`\`const text = \`outer \${\`inner \${value}\`}\`;\`\` reports the inner template.`,
        },
        schema: [],
        messages: { template: 'Name this inner template separately, or separate its delimiters onto their own lines.' },
    },
    create(context) {
        return {
            TemplateLiteral(node) {
                const enclosing = context.sourceCode
                    .getAncestors(node)
                    .findLast((ancestor) => ancestor.type === AST_NODE_TYPES.TemplateLiteral);
                if (enclosing === undefined) return;
                if (node.loc.start.line === enclosing.loc.start.line || node.loc.end.line === enclosing.loc.end.line)
                    context.report({ node, messageId: 'template' });
            },
        };
    },
});
