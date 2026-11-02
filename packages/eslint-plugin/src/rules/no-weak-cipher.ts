import { createRule } from '../rule.ts';
import { getCallText } from '../modules.ts';
import { CIPHER_FUNCTION, WEAK_CIPHER_PREFIXES } from '../config/security.ts';

export const noWeakCipher = createRule<[], 'weak'>({
    name: 'no-weak-cipher',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `crypto.createCipheriv` calls whose algorithm is Blowfish, DES, RC2, or RC4, also when a constant holds the algorithm.',
            why: 'Attackers can break these ciphers, so the data that they encrypt is not protected.',
            fix: 'Use AES with a mode that authenticates the data, such as `aes-256-gcm`.',
            example:
                'The call `crypto.createCipheriv("des-ede3-cbc", key, iv)` reports `weak`. Use `crypto.createCipheriv("aes-256-gcm", key, iv)`.',
        },
        schema: [],
        messages: { weak: 'This cipher is weak. Use a strong algorithm, such as AES-GCM.' },
    },
    create(context) {
        return {
            CallExpression(node) {
                const cipher = getCallText(node, context.sourceCode, CIPHER_FUNCTION);
                const text = cipher?.text.toLowerCase() ?? '';
                if (cipher && WEAK_CIPHER_PREFIXES.some((prefix) => text.startsWith(prefix)))
                    context.report({ node: cipher.argument, messageId: 'weak' });
            },
        };
    },
});
