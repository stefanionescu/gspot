import { createRule } from '../rule.ts';
import { listCdkTableIssues } from '../aws.ts';
import { readQualifiedName } from '../modules.ts';
import { TLS_CHECKS } from '../config/networks.ts';
import { listOptionLiterals, readOptionProperties } from '../values.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    SECURE_PROTOCOLS,
    WEAK_TLS_VERSIONS,
    REQUIRED_TLS_FLAGS,
    TLS_VERSION_OPTIONS,
    TLS_CONSTANTS_MODULES,
    WEAK_SSL_OPTION_ARGUMENTS,
} from '../config/security.ts';

function listFlags(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node): (string | null)[] {
    if (node.type === AST_NODE_TYPES.BinaryExpression)
        return [...listFlags(source, node.left), ...listFlags(source, node.right)];
    const isConstant =
        node.type === AST_NODE_TYPES.MemberExpression &&
        TLS_CONSTANTS_MODULES.has(readQualifiedName(node.object, source));
    return [isConstant ? ASTUtils.getPropertyName(node) : null];
}

export const weakSsl = createRule<[], 'oldVersion' | 'oldProtocols' | 'omittedPolicy' | 'oldPolicy'>({
    name: 'weak-ssl',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds TLS options of `https.request`, `request.get`, `tls.connect`, and `tls.createSecureContext` that allow TLS 1.1 or older: a `minVersion` or `maxVersion` of `TLSv1` or `TLSv1.1`, an old `secureProtocol`, or `secureOptions` flags that do not turn off TLS 1.0 and 1.1.',
            why: 'TLS 1.0 and 1.1 have known weaknesses, so an attacker on the network can read or change the traffic.',
            fix: 'Set `minVersion: "TLSv1.2"`, or use a `secureProtocol` of TLS 1.2 or newer.',
            example:
                'The call `tls.connect({ host, minVersion: "TLSv1.1" })` reports `oldVersion`. Use `tls.connect({ host, minVersion: "TLSv1.2" })`.',
        },
        schema: [],
        messages: {
            oldVersion: 'Change {{option}} to TLS 1.2 or newer.',
            oldProtocols: 'Change {{option}} to allow only TLS 1.2 or newer.',
            omittedPolicy: 'Leaving out {{option}} allows TLS versions older than 1.2. Set it to TLS 1.2 or newer.',
            oldPolicy: 'Change {{option}} to enforce TLS 1.2 or newer.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        const readOption = (options: TSESTree.ObjectExpression, option: string) => {
            const property = readOptionProperties(options, source).get(option);
            const value = property ? ASTUtils.getStaticValue(property.value, source.getScope(property)) : null;
            return { property, value: value?.value, isKnown: value !== null };
        };
        const checkVersions = (options: TSESTree.ObjectExpression): void => {
            for (const option of TLS_VERSION_OPTIONS) {
                const { property, value } = readOption(options, option);
                if (property && WEAK_TLS_VERSIONS.has(value))
                    context.report({ node: property, messageId: 'oldVersion', data: { option } });
            }
            const protocol = readOption(options, 'secureProtocol');
            if (protocol.property && protocol.isKnown && !SECURE_PROTOCOLS.has(protocol.value))
                context.report({
                    node: protocol.property,
                    messageId: 'oldVersion',
                    data: { option: 'secureProtocol' },
                });
        };
        const checkFlags = (options: TSESTree.ObjectExpression): void => {
            const flags = readOptionProperties(options, source).get('secureOptions');
            const names = flags ? listFlags(source, flags.value) : [];
            if (flags && !names.includes(null) && REQUIRED_TLS_FLAGS.some((flag) => !names.includes(flag)))
                context.report({ node: flags, messageId: 'oldProtocols', data: { option: 'secureOptions' } });
        };
        return {
            NewExpression(node) {
                const issues = listCdkTableIssues(source, node, TLS_CHECKS);
                for (const { node: target, kind, property } of issues)
                    context.report({
                        node: target,
                        messageId: kind === 'omitted' ? 'omittedPolicy' : 'oldPolicy',
                        data: { option: property },
                    });
            },
            CallExpression(node) {
                for (const options of listOptionLiterals(node, source, WEAK_SSL_OPTION_ARGUMENTS)) {
                    checkVersions(options);
                    checkFlags(options);
                }
            },
        };
    },
});
