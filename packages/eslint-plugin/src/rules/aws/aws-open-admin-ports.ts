import { createRule } from '../../rule.ts';
import type { AdminAccess } from '../../types/aws.ts';
import { DECIMAL_RADIX } from '../../config/plugin.ts';
import { getMemberRoot } from '../../language/syntax.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { getCdkName, getCdkResult, getCdkArgument, getCdkProperty } from '../../libraries/aws.ts';

import {
    getLiteralValue,
    getExpressionValue,
    listArgumentValues,
    getOptionProperties,
} from '../../language/expressions.ts';
import {
    ALL_PORTS,
    ANY_PEERS,
    ALLOW_FROM,
    PORT_RANGE,
    ADMIN_PORTS,
    SINGLE_PORT,
    INGRESS_RULE,
    ADDRESS_PEERS,
    ALL_PROTOCOLS,
    TCP_PROTOCOLS,
    OPEN_ADDRESSES,
    PORT_CONSTRUCT,
    SECURITY_GROUP,
    CONNECTION_OWNERS,
    DEFAULT_PORT_FROM,
    CDK_PROPS_POSITION,
    TCP_PROTOCOL_NAMES,
    ALLOW_FROM_ANY_IPV4,
    DEFAULT_PORT_ANYWHERE,
    SECURITY_GROUP_INGRESS,
} from '../../config/aws.ts';

function getField(source: Readonly<TSESLint.SourceCode>, options: TSESTree.Node | undefined, key: string): unknown {
    const property = getOptionProperties(options, source).get(key);
    if (!property) return undefined;
    return getLiteralValue(property.value, source);
}

function findArgument(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.Node | undefined,
    position: number,
): TSESTree.Node | undefined {
    const call = getExpressionValue(node, source);
    const isCall = call?.type === AST_NODE_TYPES.CallExpression || call?.type === AST_NODE_TYPES.NewExpression;
    return getExpressionValue(isCall ? call.arguments[position] : undefined, source);
}

function isAdminRange(start: number, end: number): boolean {
    return ADMIN_PORTS.some((port) => port >= start && port <= end);
}

function isAdminPortOptions(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): boolean {
    const protocol = getOptionProperties(node, source).get('protocol');
    const isTcp = protocol !== undefined && TCP_PROTOCOL_NAMES.has(getCdkName(source, protocol.value));
    const start = Number.parseInt(String(getField(source, node, 'fromPort')), DECIMAL_RADIX);
    const end = Number.parseInt(String(getField(source, node, 'toPort')), DECIMAL_RADIX);
    return isTcp && isAdminRange(start, end);
}

function isAdminPortCall(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.Node | undefined,
    name: string,
): boolean {
    const [start, end] = [0, 1].map((position) => getLiteralValue(findArgument(source, node, position), source));
    if (typeof start !== 'number') return false;
    const high = name === PORT_RANGE && typeof end === 'number' ? end : start;
    return isAdminRange(start, high);
}

function isAdminPort(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): boolean {
    const name = getCdkName(source, node);
    if (ALL_PORTS.has(name)) return true;
    return name === PORT_CONSTRUCT
        ? isAdminPortOptions(source, findArgument(source, node, 0))
        : (name === SINGLE_PORT || name === PORT_RANGE) && isAdminPortCall(source, node, name);
}

function isOpenPeer(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): boolean {
    const name = getCdkName(source, node);
    if (ANY_PEERS.has(name)) return true;
    const address = ADDRESS_PEERS.get(name);
    return address !== undefined && getLiteralValue(findArgument(source, node, 0), source) === address;
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
    const owner = getMemberRoot(node.callee);
    const isAny =
        name === DEFAULT_PORT_ANYWHERE || (name === DEFAULT_PORT_FROM && isOpenPeer(source, node.arguments[0]));
    const port = getCdkProperty(source, getCdkArgument(source, getCdkResult(source, owner), 0), 'defaultPort');
    const isConnections = getCdkResult(source, owner).node.type === AST_NODE_TYPES.NewExpression;
    return isAny && isConnections && port.status === 'found' && isAdminPort(source, port.node)
        ? [{ node: node.callee, messageId: 'anyAddress' }]
        : [];
}

function listAdminAccess(source: Readonly<TSESLint.SourceCode>, node: TSESTree.CallExpression): AdminAccess[] {
    const name = getCdkName(source, node.callee) ?? '';
    const separator = name.lastIndexOf('.');
    const isConnection = CONNECTION_OWNERS.has(name.slice(0, separator));
    const method = name.slice(separator + 1);
    if (name === INGRESS_RULE || (isConnection && method === ALLOW_FROM)) return listOpenRanges(source, node);
    if (isConnection && method === ALLOW_FROM_ANY_IPV4)
        return isAdminPort(source, node.arguments[0]) ? [{ node: node.callee, messageId: 'anyAddress' }] : [];
    return listDefaultPortAccess(source, node, name);
}

function listOpenIngress(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): AdminAccess[] {
    const protocol = getField(source, node, 'ipProtocol');
    const start = Number.parseInt(String(getField(source, node, 'fromPort')), DECIMAL_RADIX);
    const end = Number.parseInt(String(getField(source, node, 'toPort')), DECIMAL_RADIX);
    const isAdmin = protocol === ALL_PROTOCOLS || (TCP_PROTOCOLS.has(protocol) && isAdminRange(start, end));
    return Object.entries(OPEN_ADDRESSES).flatMap(([key, address]) => {
        const property = getOptionProperties(node, source).get(key);
        const value = property ? getExpressionValue(property.value, source) : undefined;
        return isAdmin && value?.type === AST_NODE_TYPES.Literal && value.value === address
            ? [{ node: value, messageId: 'openRange' as const }]
            : [];
    });
}

function listGroupIngress(source: Readonly<TSESLint.SourceCode>, node: TSESTree.NewExpression): AdminAccess[] {
    const ingress = getOptionProperties(node.arguments[2], source).get('securityGroupIngress');
    return ingress ? listArgumentValues([ingress.value], source).flatMap((rule) => listOpenIngress(source, rule)) : [];
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
            'CallExpression, NewExpression': function (node: TSESTree.CallExpression | TSESTree.NewExpression) {
                const name = getCdkName(source, node.callee);
                let found: AdminAccess[] = [];
                if (node.type === AST_NODE_TYPES.CallExpression) found = listAdminAccess(source, node);
                else if (name === SECURITY_GROUP) found = listGroupIngress(source, node);
                else if (name === SECURITY_GROUP_INGRESS)
                    found = listOpenIngress(source, node.arguments[CDK_PROPS_POSITION]);
                for (const access of found) context.report(access);
            },
        };
    },
});
