import { createRule } from '../../rule.ts';
import { getModuleName } from '../../language/modules.ts';
import { isVueThreeUsed } from '../../libraries/packages.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { VUE_CLASS_BASE, VUE_CLASS_DECORATORS, VUE_PROPERTY_DECORATORS } from '../../config/vue.ts';

function hasDecorator(
    decorators: TSESTree.Decorator[],
    names: ReadonlySet<string | undefined>,
    source: TSESLint.SourceCode,
): boolean {
    return decorators.some(({ expression }) => {
        const target = expression.type === AST_NODE_TYPES.CallExpression ? expression.callee : expression;
        return target.type === AST_NODE_TYPES.Identifier && names.has(getModuleName(target, source));
    });
}

function isClassComponent(
    node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
    source: TSESLint.SourceCode,
): boolean {
    const isVueClass =
        node.superClass?.type === AST_NODE_TYPES.Identifier &&
        getModuleName(node.superClass, source) === VUE_CLASS_BASE;
    const decorators = 'decorators' in node ? node.decorators : [];
    const members = node.body.body.flatMap((member) => ('decorators' in member ? member.decorators : []));
    return (
        isVueClass ||
        hasDecorator(decorators, VUE_CLASS_DECORATORS, source) ||
        hasDecorator([...decorators, ...members], VUE_PROPERTY_DECORATORS, source)
    );
}

export const noVueClassComponents = createRule<[], 'classComponent'>({
    name: 'no-vue-class-components',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports a class that extends `Vue` from vue-class-component, or carries its `@Component` or `@Options` decorator or a decorator of vue-property-decorator on the class or a member, in projects whose package.json allows Vue 3.',
            why: 'vue-class-component and vue-property-decorator are no longer maintained for Vue 3, and their decorators hide the component options that the Composition API writes out.',
            fix: 'Rewrite the component with `defineComponent` or `<script setup>` and the Composition API.',
            example:
                '`@Component class Cart extends Vue {}` reports `classComponent`. Write the component with `defineComponent({ setup() { ... } })`.',
        },
        schema: [],
        messages: {
            classComponent: 'Replace this deprecated Vue class-based component pattern with the Composition API.',
        },
    },
    create(context) {
        if (!isVueThreeUsed(context)) return {};
        return {
            'ClassDeclaration, ClassExpression'(node: TSESTree.ClassDeclaration | TSESTree.ClassExpression) {
                const source = context.sourceCode;
                const isComponent = isClassComponent(node, source);
                if (isComponent) context.report({ node: node.id ?? node, messageId: 'classComponent' });
            },
        };
    },
});
