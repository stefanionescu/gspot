import { createRule } from '../rule.ts';
import type { AdminAccess } from '../types/rules.ts';
import { CDK_PROPS_POSITION } from '../config/plugin.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { readLiteralValue, readExpressionValue, readOptionProperties } from '../values.ts';
import { getCdkName, isUnresolved, readCdkResult, readCdkArgument, readCdkProperty } from '../aws.ts';

import {
    ANY_PEERS,
    ALL_PORTS,
    ALLOW_FROM,
    PORT_RANGE,
    ADMIN_PORTS,
    SINGLE_PORT,
    INGRESS_RULE,
    ALL_PROTOCOLS,
    TCP_PROTOCOLS,
    ADDRESS_PEERS,
    OPEN_ADDRESSES,
    PORT_CONSTRUCT,
    SECURITY_GROUP,
    CONNECTION_OWNERS,
    DEFAULT_PORT_FROM,
    TCP_PROTOCOL_NAMES,
    ALLOW_FROM_ANY_IPV4,
    DEFAULT_PORT_ANYWHERE,
    SECURITY_GROUP_INGRESS,
} from '../config/networks.ts';

function readField(source: Readonly<TSESLint.SourceCode>, options: TSESTree.ObjectExpression, key: string): unknown {
    const property = readOptionProperties(options, source).get(key);
    if (!property) return undefined;
    return readLiteralValue(property.value, source);
}

function readTracedValue(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.Node | undefined,
): TSESTree.Node | undefined {
    if (node === undefined || isUnresolved(source, node)) return undefined;
    return readExpressionValue(node, source) ?? node;
}

function findArgument(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.Node | undefined,
    position: number,
): TSESTree.Node | undefined {
    const call = readTracedValue(source, node);
    const isCall = call?.type === AST_NODE_TYPES.CallExpression || call?.type === AST_NODE_TYPES.NewExpression;
    return readTracedValue(source, isCall ? call.arguments[position] : undefined);
}

function isAdminRange(start: number | undefined, end: number | undefined): boolean {
    if (start === undefined) return false;
    const high = end ?? start;
    return ADMIN_PORTS.some((port) => port >= start && port <= high);
}

function isAdminPortOptions(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): boolean {
    const options = readExpressionValue(node, source);
    if (options?.type !== AST_NODE_TYPES.ObjectExpression) return false;
    const protocol = readOptionProperties(options, source).get('protocol');
    const value = protocol ? (readExpressionValue(protocol.value, source) ?? protocol.value) : undefined;
    const isTcp =
        value !== undefined && !isUnresolved(source, value) && TCP_PROTOCOL_NAMES.has(getCdkName(source, value));
    const [start, end] = ['fromPort', 'toPort'].map((key) => Number.parseInt(String(readField(source, options, key))));
    return isTcp && isAdminRange(start, end);
}

function isAdminPortCall(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.Node | undefined,
    name: string,
): boolean {
    const [start, end] = [0, 1].map((position) => readLiteralValue(findArgument(source, node, position), source));
    const high = name === PORT_RANGE && typeof end === 'number' ? end : undefined;
    return typeof start === 'number' && isAdminRange(start, high);
}

function isAdminPort(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): boolean {
    const name = node === undefined ? '' : (getCdkName(source, node) ?? '');
    if (ALL_PORTS.has(name)) return true;
    if (name === PORT_CONSTRUCT) return isAdminPortOptions(source, findArgument(source, node, 0));
    return (name === SINGLE_PORT || name === PORT_RANGE) && isAdminPortCall(source, node, name);
}

function isOpenPeer(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): boolean {
    const name = node === undefined ? '' : (getCdkName(source, node) ?? '');
    if (ANY_PEERS.has(name)) return true;
    const address = Object.hasOwn(ADDRESS_PEERS, name) ? ADDRESS_PEERS[name] : undefined;
    return address !== undefined && readLiteralValue(findArgument(source, node, 0), source) === address;
}

function listOpenRanges(source: Readonly<TSESLint.SourceCode>, node: TSESTree.CallExpression): AdminAccess[] {
    const [peer, port] = node.arguments;
    const isOpen = peer !== undefined && isOpenPeer(source, peer) && isAdminPort(source, port);
    return isOpen ? [{ node: peer, messageId: 'openRange' }] : [];
}

function listDefaultPortAccess(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression,
    name: string,
): AdminAccess[] {
    let owner: TSESTree.Node = node.callee;
    while (owner.type === AST_NODE_TYPES.MemberExpression) owner = owner.object;
    const isAny =
        name === DEFAULT_PORT_ANYWHERE || (name === DEFAULT_PORT_FROM && isOpenPeer(source, node.arguments[0]));
    const port = readCdkProperty(source, readCdkArgument(source, readCdkResult(source, owner), 0), 'defaultPort');
    const isConnections = readCdkResult(source, owner).node.type === AST_NODE_TYPES.NewExpression;
    return isAny && isConnections && port.status === 'found' && isAdminPort(source, port.node)
        ? [{ node: node.callee, messageId: 'anyAddress' }]
        : [];
}

function listAdminAccess(source: Readonly<TSESLint.SourceCode>, node: TSESTree.CallExpression): AdminAccess[] {
    const name = getCdkName(source, node.callee) ?? '';
    const separator = name.lastIndexOf('.');
    const isConnection = CONNECTION_OWNERS.has(name.slice(0, separator));
    const method = name.slice(separator + 1);
    if ((isConnection && method === ALLOW_FROM) || name === INGRESS_RULE) return listOpenRanges(source, node);
    if (isConnection && method === ALLOW_FROM_ANY_IPV4)
        return isAdminPort(source, node.arguments[0]) ? [{ node: node.callee, messageId: 'anyAddress' }] : [];
    return listDefaultPortAccess(source, node, name);
}

function listOpenIngress(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | null | undefined): AdminAccess[] {
    const options = readExpressionValue(node ?? undefined, source);
    if (options?.type !== AST_NODE_TYPES.ObjectExpression) return [];
    const protocol = readField(source, options, 'ipProtocol');
    const [start, end] = ['fromPort', 'toPort'].map((key) => Number.parseInt(String(readField(source, options, key))));
    const isAdmin = protocol === ALL_PROTOCOLS || (TCP_PROTOCOLS.has(protocol) && isAdminRange(start, end));
    return Object.entries(OPEN_ADDRESSES).flatMap(([key, address]) => {
        const property = readOptionProperties(options, source).get(key);
        const value = property ? readExpressionValue(property.value, source) : undefined;
        return isAdmin && value?.type === AST_NODE_TYPES.Literal && value.value === address
            ? [{ node: value, messageId: 'openRange' as const }]
            : [];
    });
}

function listGroupIngress(source: Readonly<TSESLint.SourceCode>, node: TSESTree.NewExpression): AdminAccess[] {
    const options = readExpressionValue(node.arguments[2], source);
    const ingress =
        options?.type === AST_NODE_TYPES.ObjectExpression
            ? readOptionProperties(options, source).get('securityGroupIngress')
            : null;
    const rules = ingress ? readExpressionValue(ingress.value, source) : undefined;
    return rules?.type === AST_NODE_TYPES.ArrayExpression
        ? rules.elements.flatMap((rule) => listOpenIngress(source, rule))
        : [];
}

export const awsOpenAdminPorts = createRule<[], 'openRange' | 'anyAddress'>({
    name: 'aws-open-admin-ports',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds AWS CDK security group rules that open the SSH port 22 or the RDP port 3389 to every IPv4 or IPv6 address: `allowFrom`, `allowFromAnyIpv4`, `allowDefaultPortFrom`, `allowDefaultPortFromAnyIpv4`, `addIngressRule`, `CfnSecurityGroup`, and `CfnSecurityGroupIngress`.',
            why: 'An administration port open to the internet invites password guessing and attacks on the service behind it.',
            fix: 'Allow the port only from the addresses of trusted networks, or reach the hosts through a bastion or AWS Systems Manager.',
            example:
                'The call `group.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22))` reports `openRange`. Use `ec2.Peer.ipv4("203.0.113.0/24")`.',
        },
        schema: [],
        messages: {
            openRange: 'Change this IP range to a subset of trusted IP addresses.',
            anyAddress: 'Replace this method with allowFrom, and allow only a subset of trusted IP addresses.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            'CallExpression, NewExpression'(node: TSESTree.CallExpression | TSESTree.NewExpression) {
                const name = getCdkName(source, node.callee) ?? '';
                const isSpread = node.arguments.some(({ type }) => type === AST_NODE_TYPES.SpreadElement);
                let found: AdminAccess[] = [];
                if (node.type === AST_NODE_TYPES.CallExpression) found = listAdminAccess(source, node);
                else if (name === SECURITY_GROUP) found = listGroupIngress(source, node);
                else if (name === SECURITY_GROUP_INGRESS)
                    found = listOpenIngress(source, node.arguments[CDK_PROPS_POSITION]);
                for (const access of isSpread ? [] : found) context.report(access);
            },
        };
    },
});
