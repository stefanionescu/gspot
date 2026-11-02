import { createRule } from '../rule.ts';
import type { StateHook } from '../types/rules.ts';
import { FUNCTION_NODES } from '../config/rules.ts';
import { COMPONENT_NAME } from '../config/frameworks.ts';
import { getStateHook, isNamedFunction } from '../libraries/react.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function isComponentBody(hook: StateHook, ancestors: TSESTree.Node[], source: TSESLint.SourceCode): boolean {
    const owner = ancestors.findLast((ancestor) => FUNCTION_NODES.has(ancestor.type));
    const index = owner === undefined ? -1 : ancestors.indexOf(owner);
    const hookOwner = source.getAncestors(hook.call).findLast((ancestor) => FUNCTION_NODES.has(ancestor.type));
    const isOutermost = !ancestors
        .slice(0, index)
        .some((ancestor) => FUNCTION_NODES.has(ancestor.type) && isNamedFunction(ancestor, COMPONENT_NAME));
    const isConditional = ancestors.slice(index).some((ancestor) => ancestor.type === AST_NODE_TYPES.IfStatement);
    const isComponent = owner !== undefined && hookOwner === owner && isNamedFunction(owner, COMPONENT_NAME);
    return isComponent && isOutermost && !isConditional && hook.call.arguments.length === 1;
}

export const noSetterInComponent = createRule<[], 'setter'>({
    name: 'no-setter-in-component',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a call of a React `useState` setter in the body of the outermost component that declares the state, outside any `if` and any nested function. A component is a function whose name does not start with a lowercase letter.',
            why: 'Each state change renders the component again, and the body sets the state again on that render, so the component loops until React stops it.',
            fix: 'Set the state in an event handler, an effect, or an attribute callback, or compute the value during the render without state.',
            example:
                '`function Cart() { const [count, setCount] = useState(0); setCount(1); }` reports `setter`. Call `setCount(1)` from an event handler.',
        },
        schema: [],
        messages: { setter: 'Remove this state setter call; call it from an event handler or a JSX attribute.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'CallExpression[callee.type="Identifier"][arguments.length=1]'(
                node: TSESTree.CallExpression & { callee: TSESTree.Identifier },
            ) {
                const hook = getStateHook(node.callee, source);
                const isSetter = hook !== undefined && hook.name === hook.setter;
                if (isSetter && isComponentBody(hook, source.getAncestors(node), source))
                    context.report({ node: node.callee, messageId: 'setter' });
            },
        };
    },
});
