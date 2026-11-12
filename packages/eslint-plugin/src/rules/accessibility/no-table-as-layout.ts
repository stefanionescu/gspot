import { isLayoutTable } from '../../language/jsx.ts';
import { createRule } from '../../rule.ts';

export const noTableAsLayout = createRule<[], 'layoutTable'>({
    name: 'no-table-as-layout',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description: 'Finds JSX `<table>` elements with `role="presentation"` or `role="none"`.',
            why: 'A table used for layout confuses screen readers and breaks on small screens, and the role only hides the confusion.',
            fix: 'Lay the content out with CSS, such as a grid or a flexbox, and keep tables for tabular data.',
            example:
                'The element `<table role="presentation"><tr><td>{menu}</td><td>{page}</td></tr></table>` reports `layoutTable`. Use `<div className="layout">{menu}{page}</div>` with a CSS grid.',
        },
        schema: [],
        messages: { layoutTable: 'Replace this layout table with a CSS layout.' },
    },
    create(context) {
        return {
            JSXOpeningElement(node) {
                const isLayout = isLayoutTable(node);
                if (isLayout) context.report({ node, messageId: 'layoutTable' });
            },
        };
    },
});
