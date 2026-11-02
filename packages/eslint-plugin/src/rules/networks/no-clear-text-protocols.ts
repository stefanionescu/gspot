import { createRule } from '../../rule.ts';
import { getQualifiedName } from '../../language/modules.ts';
import type { ClearTextReport, ClearTextListener } from '../../types/security.ts';
import { getCdkName, listCdkIssues, listCdkTableIssues } from '../../libraries/aws.ts';
import { getExpressionValue, getOptionProperties } from '../../language/expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    FTP_MODULE,
    EXEMPT_HOSTS,
    AUTHORITY_END,
    TELNET_IMPORT,
    MAIL_TRANSPORT,
    TELNET_REQUIRE,
    NAMESPACE_HOSTS,
    NAMESPACE_PATHS,
    SECURE_MAIL_PORT,
    PROTOCOL_SEPARATOR,
    CLEAR_TEXT_MESSAGES,
    MAIL_SECURE_OPTIONS,
    CLEAR_TEXT_LISTENERS,
    CLEAR_TEXT_CALL_CHECKS,
    ADDRESS_LITERAL_SELECTOR,
    CLEAR_TEXT_CONSTRUCT_CHECKS,
    SECURE_PROTOCOL_ALTERNATIVES,
} from '../../config/networks.ts';

function getHost(url: string): { host: string; path: string | undefined } {
    try {
        const parsed = new URL(url);
        return { host: parsed.hostname, path: parsed.pathname };
    } catch {
        const [authority = ''] = url
            .slice(url.indexOf(PROTOCOL_SEPARATOR) + PROTOCOL_SEPARATOR.length)
            .split(AUTHORITY_END);
        const [host = ''] = authority.slice(authority.lastIndexOf('@') + 1).split(':', 1);
        return { host, path: undefined };
    }
}

function isExemptUrl(url: string): boolean {
    const { host, path } = getHost(url);
    const paths = Object.hasOwn(NAMESPACE_PATHS, host) ? NAMESPACE_PATHS[host] : undefined;
    const isNamespace =
        NAMESPACE_HOSTS.has(host) || paths?.some((prefix) => path?.startsWith(prefix) === true) === true;
    return host !== '' && (isNamespace || EXEMPT_HOSTS.some((pattern) => pattern.test(host)));
}

function getClearTextProtocol(node: TSESTree.Literal): string | undefined {
    const url = typeof node.value === 'string' ? node.value.trim().toLowerCase() : '';
    const protocol = url.slice(0, Math.max(url.indexOf(PROTOCOL_SEPARATOR), 0));
    if (!Object.hasOwn(SECURE_PROTOCOL_ALTERNATIVES, protocol)) return undefined;
    const isConcatenated = node.parent.type === AST_NODE_TYPES.BinaryExpression && node.parent.operator === '+';
    const isReported = url === `${protocol}${PROTOCOL_SEPARATOR}` ? isConcatenated : !isExemptUrl(url);
    return isReported ? protocol : undefined;
}

function describeProtocol(node: TSESTree.Node | undefined, protocol: string | undefined): ClearTextReport[] {
    if (node === undefined || protocol === undefined) return [];
    return [{ node, messageId: 'clearText', data: { protocol, alternative: SECURE_PROTOCOL_ALTERNATIVES[protocol] } }];
}

function isSecureOption(
    source: Readonly<TSESLint.SourceCode>,
    options: TSESTree.ObjectExpression,
    key: string,
): boolean {
    const option = getOptionProperties(options, source).get(key);
    if (!option) return false;
    const { value } = option;
    if (value.type !== AST_NODE_TYPES.Literal) return true;
    return key === 'port' ? value.value === SECURE_MAIL_PORT : value.value !== false;
}

function isClearTextMail(source: Readonly<TSESLint.SourceCode>, node: TSESTree.CallExpression): boolean {
    const options = getExpressionValue(node.arguments[0], source);
    return (
        options?.type === AST_NODE_TYPES.ObjectExpression &&
        MAIL_SECURE_OPTIONS.every((key) => !isSecureOption(source, options, key))
    );
}

function isClearTextFtp(source: Readonly<TSESLint.SourceCode>, node: TSESTree.CallExpression): boolean {
    const { callee } = node;
    const isConnect = callee.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(callee) === 'connect';
    const client = isConnect ? getExpressionValue(callee.object, source) : undefined;
    const isFtp =
        client?.type === AST_NODE_TYPES.NewExpression && getQualifiedName(client.callee, source) === FTP_MODULE;
    const option = getOptionProperties(node.arguments[0], source).get('secure');
    return isFtp && option?.value.type === AST_NODE_TYPES.Literal && option.value.value === false;
}

function findClearTextListener(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression | TSESTree.NewExpression,
    listener: ClearTextListener,
): TSESTree.Node | undefined {
    const { position, protocols, omission } = listener;
    const [protocol] = listCdkIssues(source, node, {
        path: ['protocol'],
        required: false,
        position,
        invalidNames: protocols,
    });
    if (protocol) return protocol.node;
    const [omitted] = listCdkIssues(source, node, { path: ['protocol'], required: true, position });
    return omitted ? listCdkIssues(source, node, { ...omission, position })[0]?.node : undefined;
}

function findListener(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression | TSESTree.NewExpression,
): TSESTree.Node | undefined {
    const name = getCdkName(source, node.callee) ?? '';
    const listeners: Readonly<Record<string, ClearTextListener>> = CLEAR_TEXT_LISTENERS;
    const listener = Object.hasOwn(listeners, name) ? listeners[name] : undefined;
    const kind = node.type === AST_NODE_TYPES.NewExpression ? 'construct' : 'call';
    return listener?.kind === kind && node.arguments.every(({ type }) => type !== AST_NODE_TYPES.SpreadElement)
        ? findClearTextListener(source, node, listener)
        : undefined;
}

function listCallIssues(source: Readonly<TSESLint.SourceCode>, node: TSESTree.CallExpression): ClearTextReport[] {
    const isMail = getQualifiedName(node, source) === MAIL_TRANSPORT && isClearTextMail(source, node);
    const listener = findListener(source, node);
    const issues = listCdkTableIssues(source, node, CLEAR_TEXT_CALL_CHECKS).map(({ node: target }) => target);
    const targets = listener === undefined ? issues : [...issues, listener];
    return [
        ...(isMail ? describeProtocol(node.callee, 'http') : []),
        ...(isClearTextFtp(source, node) ? describeProtocol(node.callee, 'ftp') : []),
        ...targets.map((target): ClearTextReport => ({ node: target, messageId: 'noTls' })),
    ];
}

function listConstructIssues(source: Readonly<TSESLint.SourceCode>, node: TSESTree.NewExpression): ClearTextReport[] {
    const messageId = CLEAR_TEXT_MESSAGES.get(getCdkName(source, node.callee)) ?? 'noTls';
    const listener = findListener(source, node);
    const issues = listCdkTableIssues(source, node, CLEAR_TEXT_CONSTRUCT_CHECKS).map(
        ({ node: target }): ClearTextReport => ({ node: target, messageId }),
    );
    return listener === undefined ? issues : [...issues, { node: listener, messageId: 'noTls' }];
}

export const noClearTextProtocols = createRule<[], 'clearText' | 'transitEncryption' | 'streamEncryption' | 'noTls'>({
    name: 'no-clear-text-protocols',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds clear-text network protocols: URLs of `http`, `ftp`, `ws`, `telnet`, `smtp`, `ldap`, and 11 other protocols that have a secure twin, except for local, cloud metadata, documentation, and namespace hosts; `nodemailer` transports without TLS; `ftp` connections with `secure: false`; the `telnet-client` package; and AWS CDK load balancers, listeners, ElastiCache groups, and Kinesis streams without TLS or encryption in transit.',
            why: 'A clear-text protocol sends data and credentials that anyone on the network path can read and change.',
            fix: 'Use the secure protocol, such as `https`, `sftp`, or `wss`, and turn on TLS for mail, FTP, and AWS resources.',
            example:
                'The literal `"https://api.acme.io/users"` reports `clearText`. Use `"https://api.acme.io/users"`. `"http://localhost:3000"` and `"https://www.example.com"` pass.',
        },
        schema: [],
        messages: {
            clearText: '{{protocol}} sends data in clear text. Use {{alternative}} instead.',
            transitEncryption: 'Make sure that turning off encryption in transit is safe here.',
            streamEncryption: 'Make sure that turning off stream encryption is safe here.',
            noTls: 'Make sure that using a network protocol without TLS is safe here.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            [ADDRESS_LITERAL_SELECTOR](node: TSESTree.Literal) {
                const found = describeProtocol(node, getClearTextProtocol(node));
                for (const report of found) context.report(report);
            },
            [TELNET_IMPORT](node: TSESTree.ImportDeclaration) {
                const found = describeProtocol(node.source, 'telnet');
                for (const report of found) context.report(report);
            },
            [TELNET_REQUIRE](node: TSESTree.CallExpression) {
                const found = describeProtocol(node.arguments[0], 'telnet');
                for (const report of found) context.report(report);
            },
            CallExpression(node) {
                const found = listCallIssues(source, node);
                for (const report of found) context.report(report);
            },
            NewExpression(node) {
                const found = listConstructIssues(source, node);
                for (const report of found) context.report(report);
            },
        };
    },
});
