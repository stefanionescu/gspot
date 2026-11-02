import { createRule } from '../../rule.ts';
import { getQualifiedName } from '../../language/modules.ts';
import { getExpressionValue, getOptionProperties } from '../../language/expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    SECRET_ARGUMENTS,
    SECRET_PROPERTIES,
    PLACEHOLDER_SECRET,
    PLACEHOLDER_SECRET_LENGTH,
} from '../../config/security.ts';

function isHardcodedString(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): boolean {
    const value =
        node === undefined || node.type === AST_NODE_TYPES.SpreadElement
            ? null
            : ASTUtils.getStaticValue(node, source.getScope(node));
    const text = value?.value;
    return typeof text === 'string' && text.length > PLACEHOLDER_SECRET_LENGTH && !PLACEHOLDER_SECRET.test(text);
}

function listSecretValues(node: TSESTree.CallExpression, name: string, source: TSESLint.SourceCode): TSESTree.Node[] {
    const options = getExpressionValue(node.arguments[0], source);
    if (!Object.hasOwn(SECRET_PROPERTIES, name) || options?.type !== AST_NODE_TYPES.ObjectExpression) return [];
    const property = getOptionProperties(options, source).get(SECRET_PROPERTIES[name] ?? '');
    return property?.value.type === AST_NODE_TYPES.ArrayExpression
        ? property.value.elements.filter((element) => element !== null)
        : [property?.value].filter((value) => value !== undefined);
}

function listSecrets(node: TSESTree.CallExpression, source: TSESLint.SourceCode): Array<TSESTree.Node | undefined> {
    const name = getQualifiedName(node, source) ?? '';
    const positions = Object.hasOwn(SECRET_ARGUMENTS, name) ? SECRET_ARGUMENTS[name] : undefined;
    return [...(positions ?? []).map((index) => node.arguments[index]), ...listSecretValues(node, name, source)];
}

export const hardcodedSecretSignatures = createRule<[], 'hardcoded'>({
    name: 'hardcoded-secret-signatures',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: `Finds a string written in the code that a call passes as a secret, except a value of five characters or fewer and a placeholder such as \`\${SECRET}\`, \`example-key\`, or \`changeme\`: the key of \`crypto.createHmac\`, \`jsonwebtoken.sign\`, \`jsonwebtoken.verify\`, and other signing and decryption functions, the secret of \`cookie-parser\`, \`express-session\`, and \`cookie-session\`, and the password of \`mysql\`, \`mysql2\`, and \`typeorm\` connections.`,
            why: 'A secret in the code reaches everyone who can read the repository or the built files, so it protects nothing.',
            fix: 'Revoke the secret, and read its replacement from the environment or a secret store at run time.',
            example:
                'The call `jwt.sign(claims, "s3cr3t")` reports `hardcoded`. Use `jwt.sign(claims, process.env.JWT_SECRET)`.',
        },
        schema: [],
        messages: { hardcoded: 'Revoke and replace this secret. The code shows it to everyone who reads it.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            CallExpression(node) {
                const secrets = listSecrets(node, source);
                for (const secret of secrets)
                    if (isHardcodedString(source, secret))
                        context.report({ node: node.callee, messageId: 'hardcoded' });
            },
        };
    },
});
