import { createRule } from '../../rule.ts';
import { READONLY_STATIC_FILES } from '../../config/types.ts';

export const preferReadonlyStatic = createRule<[], 'readonly'>({
    name: 'prefer-readonly-static',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description: 'Requires public static TypeScript properties to be readonly.',
            why: 'A writable public static property lets any caller change state shared by every class instance.',
            fix: 'Add readonly to the static property, or make mutable state private.',
            example: '`class Clock { static readonly interval = 1000; }` protects the public shared value.',
        },
        schema: [],
        messages: { readonly: 'Make this public static property readonly, or make mutable state private.' },
    },
    create(context) {
        if (!READONLY_STATIC_FILES.test(context.filename)) return {};
        return {
            PropertyDefinition(node) {
                if (
                    !node.static ||
                    node.readonly ||
                    node.accessibility === 'private' ||
                    node.accessibility === 'protected'
                )
                    return;
                context.report({ node, messageId: 'readonly' });
            },
        };
    },
});
