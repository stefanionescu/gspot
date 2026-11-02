import { createRule } from '../rule.ts';
import { ENDING_PAIR } from '../config/regex.ts';
import { buildRegexVisitors } from '../language/regex.ts';

export const noLazyBeforeOptional = createRule<[], 'lazy'>({
    name: 'no-lazy-before-optional',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a lazy quantifier that only a quantifier able to match nothing follows at the end of a top-level alternative, such as `a*?` in `/a*?b*/`. `regexp/no-lazy-ends` reports a lazy quantifier that ends the pattern itself.',
            why: 'Nothing after the lazy quantifier forces it to match more, so it always matches its minimum.',
            fix: 'Make the quantifier greedy, or make the part after it match at least one character.',
            example: '`/a*?b*/` reports `lazy`, because `a*?` always matches nothing.',
        },
        schema: [],
        messages: {
            lazy: 'This lazy quantifier always matches {{minimum}} repetitions. Make it greedy or change what follows.',
        },
    },
    create(context) {
        return buildRegexVisitors((node, regex) => {
            for (const { elements } of regex.pattern.alternatives) {
                const [lazy, last] = elements.slice(-ENDING_PAIR);
                if (lazy?.type !== 'Quantifier' || lazy.greedy || last?.type !== 'Quantifier' || last.min !== 0)
                    continue;
                context.report({ node, messageId: 'lazy', data: { minimum: lazy.min } });
            }
        }, context.sourceCode);
    },
});
