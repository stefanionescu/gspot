import { createRule } from '../../rule.ts';
import type { TSESTree } from '@typescript-eslint/utils';

export const noDuplicateInComposite = createRule<[], 'duplicate'>({
    name: 'no-duplicate-in-composite',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports a member of a union or intersection type that repeats the text of an earlier member, such as `string | string`.',
            why: 'A repeated member adds nothing to the type, and often stands where a different member was meant.',
            fix: 'Remove the repeated member, or replace it with the type that was meant.',
            example: '`type Id = string | number | string;` reports `duplicate` at the second `string`.',
        },
        schema: [],
        messages: { duplicate: 'This member repeats {{text}}. Remove it or replace it with the intended type.' },
    },
    create(context) {
        const inspect = (node: TSESTree.TSUnionType | TSESTree.TSIntersectionType) => {
            const seen = new Set<string>();
            for (const member of node.types) {
                const text = context.sourceCode.getText(member);
                if (seen.has(text)) context.report({ node: member, messageId: 'duplicate', data: { text } });
                seen.add(text);
            }
        };
        return { TSUnionType: inspect, TSIntersectionType: inspect };
    },
});
