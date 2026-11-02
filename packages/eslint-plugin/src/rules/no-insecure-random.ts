import { createRule } from '../rule.ts';
import { getModuleName } from '../modules.ts';
import { INSECURE_RANDOM_GENERATOR } from '../config/security.ts';

export const noInsecureRandom = createRule<[], 'random'>({
    name: 'no-insecure-random',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Reports Math.random calls, including aliases and destructured references.',
            why: 'Predictable random values cannot protect tokens, identifiers, or other security decisions.',
            fix: 'Use crypto.getRandomValues, crypto.randomUUID, or the cryptographic random API of the runtime.',
            example: '`const token = crypto.randomUUID();` uses cryptographic randomness for an identifier.',
        },
        schema: [],
        messages: { random: 'Use the cryptographic random API of the runtime instead of Math.random.' },
    },
    create(context) {
        return {
            CallExpression: (node) => {
                if (getModuleName(node.callee, context.sourceCode) === INSECURE_RANDOM_GENERATOR)
                    context.report({ node, messageId: 'random' });
            },
        };
    },
});
