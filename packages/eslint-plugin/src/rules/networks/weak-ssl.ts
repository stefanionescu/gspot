import { createRule } from '../../rule.ts';
import { listCdkTableIssues } from '../../libraries/aws.ts';
import { getQualifiedName } from '../../language/modules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { getOptionValue, listOptionLiterals, getOptionProperties } from '../../language/expressions.ts';

import {
    TLS_CHECKS,
    SECURE_PROTOCOLS,
    WEAK_TLS_VERSIONS,
    REQUIRED_TLS_FLAGS,
    TLS_VERSION_OPTIONS,
    TLS_CONSTANTS_MODULES,
    WEAK_SSL_OPTION_ARGUMENTS,
} from '../../config/networks.ts';

function listFlags(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node): Array<string | null> {
    if (node.type === AST_NODE_TYPES.BinaryExpression)
        return [...listFlags(source, node.left), ...listFlags(source, node.right)];
    const isConstant =
        node.type === AST_NODE_TYPES.MemberExpression &&
        TLS_CONSTANTS_MODULES.has(getQualifiedName(node.object, source));
    return [isConstant ? ASTUtils.getPropertyName(node) : null];
}

function listVersionIssues(
    options: TSESTree.ObjectExpression,
    source: Readonly<TSESLint.SourceCode>,
): Array<TSESLint.ReportDescriptor<'oldVersion'>> {
    const issues = TLS_VERSION_OPTIONS.flatMap((option): Array<TSESLint.ReportDescriptor<'oldVersion'>> => {
        const found = getOptionValue(options, option, source);
        return found !== undefined && WEAK_TLS_VERSIONS.has(found.value)
            ? [{ node: found.property, messageId: 'oldVersion', data: { option } }]
            : [];
    });
    const protocol = getOptionValue(options, 'secureProtocol', source);
    if (protocol?.isKnown === true && !SECURE_PROTOCOLS.has(protocol.value))
        issues.push({ node: protocol.property, messageId: 'oldVersion', data: { option: 'secureProtocol' } });
    return issues;
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
        const checkFlags = (options: TSESTree.ObjectExpression): void => {
            const flags = getOptionProperties(options, source).get('secureOptions');
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
                    for (const issue of listVersionIssues(options, source)) context.report(issue);
                    checkFlags(options);
                }
            },
        };
    },
});
