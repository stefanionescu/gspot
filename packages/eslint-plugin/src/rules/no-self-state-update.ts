import { createRule } from '../rule.ts';
import { readStateHook } from '../react.ts';
import { ASTUtils, type TSESTree } from '@typescript-eslint/utils';

export const noSelfStateUpdate = createRule<[], 'useless'>({
    name: 'no-self-state-update',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a call of a React `useState` setter whose only argument is the state variable of the same `useState` call.',
            why: 'Setting the state to the value it already holds changes nothing. The call usually stands where another value was meant.',
            fix: 'Pass the new value, or delete the call.',
            example:
                '`const [count, setCount] = useState(0); setCount(count);` reports `useless`. Write `setCount(count + 1)`.',
        },
        schema: [],
        messages: { useless: 'Change the argument of this setter so it does not pass its own state variable.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'CallExpression[callee.type="Identifier"][arguments.length=1][arguments.0.type="Identifier"]'(
                node: TSESTree.CallExpression & { callee: TSESTree.Identifier },
            ) {
                const hook = readStateHook(node.callee, source);
                const [argument] = node.arguments;
                const value = ASTUtils.isIdentifier(argument) ? readStateHook(argument, source) : undefined;
                if (hook !== undefined && hook.name === hook.setter && value?.name === hook.value)
                    context.report({ node, messageId: 'useless' });
            },
        };
    },
});
