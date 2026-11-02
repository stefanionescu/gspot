import { createRule } from '../../rule.ts';
import { isTypeAlias } from '../../language/syntax.ts';
import { REDUNDANT_TYPE_KEYWORDS } from '../../config/rules.ts';

export const redundantTypeAliases = createRule<[], 'redundant'>({
    name: 'redundant-type-aliases',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description: 'Reports aliases that only rename a primitive or another type.',
            why: 'A second name hides the original type without adding a constraint.',
            fix: 'Use the original type. Keep aliases that define a union, a shape, or concrete generic arguments.',
            example: '`type Label = string;` adds no constraint. Use `string` at its call sites.',
        },
        schema: [],
        messages: { redundant: 'Use {{type}} directly instead of giving it another name.' },
    },
    create(context) {
        return {
            TSTypeAliasDeclaration(node) {
                if (!REDUNDANT_TYPE_KEYWORDS.has(node.typeAnnotation.type) && !isTypeAlias(node)) return;
                context.report({
                    node: node.id,
                    messageId: 'redundant',
                    data: { type: context.sourceCode.getText(node.typeAnnotation) },
                });
            },
        };
    },
});
