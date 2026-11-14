import { createRule } from '../../rule.ts';
import { getCallText } from '../../language/modules.ts';
import { INSECURE_MODES, CIPHER_FUNCTION, MODELESS_CIPHERS } from '../../config/cryptography.ts';

export const encryptionSecureMode = createRule<[], 'insecure'>({
    name: 'encryption-secure-mode',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `crypto.createCipheriv` calls whose algorithm uses the CBC or ECB mode, or names a block cipher without a mode, also when a constant holds the algorithm.',
            why: 'ECB shows the patterns of the data. CBC without a message check lets attackers change or decrypt the data through padding errors.',
            fix: 'Use a mode that authenticates the data, such as GCM: `aes-256-gcm`.',
            example:
                'The call `crypto.createCipheriv("aes-128-cbc", key, iv)` reports `insecure`. Use `crypto.createCipheriv("aes-128-gcm", key, iv)`.',
        },
        schema: [],
        messages: { insecure: 'This cipher mode is not secure. Use a mode that authenticates the data, such as GCM.' },
    },
    create(context) {
        return {
            CallExpression(node) {
                const cipher = getCallText(node, context.sourceCode, CIPHER_FUNCTION);
                const text = cipher?.text ?? '';
                if (cipher && (INSECURE_MODES.test(text) || MODELESS_CIPHERS.has(text.toLowerCase())))
                    context.report({ node: cipher.argument, messageId: 'insecure' });
            },
        };
    },
});
