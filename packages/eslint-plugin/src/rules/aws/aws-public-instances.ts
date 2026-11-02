import { createRule } from '../../rule.ts';
import type { CdkResult } from '../../types/plugin.ts';
import { listArgumentValues } from '../../language/expressions.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    getCdkName,
    getCdkResult,
    getCdkLiteral,
    getCdkArgument,
    getCdkProperty,
    listCdkTableIssues,
} from '../../libraries/aws.ts';
import {
    RDS_INSTANCE,
    PUBLIC_SUBNET,
    PRIVATE_SUBNETS,
    COMPUTE_INSTANCE,
    CDK_PROPS_POSITION,
    PUBLIC_NETWORK_CHECKS,
    SUBNET_SELECTION_METHOD,
} from '../../config/aws.ts';

function findSubnetSelection(source: Readonly<TSESLint.SourceCode>, networkInterface: CdkResult): CdkResult {
    let subnet = getCdkProperty(source, networkInterface, 'subnetId');
    while (subnet.status === 'found' && subnet.node.type === AST_NODE_TYPES.MemberExpression)
        subnet = getCdkResult(source, subnet.node.object);
    return subnet;
}

function isPrivateInterface(source: Readonly<TSESLint.SourceCode>, networkInterface: CdkResult): boolean {
    const subnet = findSubnetSelection(source, networkInterface);
    const { node } = subnet;
    const isSelection =
        node.type === AST_NODE_TYPES.CallExpression &&
        node.arguments.length === 1 &&
        node.callee.type === AST_NODE_TYPES.MemberExpression &&
        ASTUtils.getPropertyName(node.callee) === SUBNET_SELECTION_METHOD;
    const type = isSelection ? getCdkProperty(source, getCdkArgument(source, subnet, 0), 'subnetType') : undefined;
    return type?.status === 'found' && PRIVATE_SUBNETS.has(getCdkName(source, type.node));
}

function findPublicInterface(source: Readonly<TSESLint.SourceCode>, options: CdkResult): TSESTree.Node | undefined {
    const interfaces = getCdkProperty(source, options, 'networkInterfaces');
    const elements = interfaces.status === 'found' ? listArgumentValues([interfaces.node], source) : [];
    for (const element of elements) {
        const networkInterface = getCdkResult(source, element);
        const address = getCdkProperty(source, networkInterface, 'associatePublicIpAddress');
        if (getCdkLiteral(address) === true && !isPrivateInterface(source, networkInterface)) return address.node;
    }
    return undefined;
}

function findPublicDatabase(source: Readonly<TSESLint.SourceCode>, options: CdkResult): TSESTree.Node | undefined {
    const subnet = getCdkProperty(source, getCdkProperty(source, options, 'vpcSubnets'), 'subnetType');
    const access = getCdkProperty(source, options, 'publiclyAccessible');
    if (getCdkName(source, subnet.node) !== PUBLIC_SUBNET) return undefined;
    if (getCdkLiteral(access) === true) return access.node;
    return access.status === 'found' ? undefined : subnet.node;
}

function listPublicNodes(source: Readonly<TSESLint.SourceCode>, node: TSESTree.NewExpression): TSESTree.Node[] {
    const name = getCdkName(source, node.callee);
    const options = getCdkArgument(source, getCdkResult(source, node), CDK_PROPS_POSITION);
    const issues = listCdkTableIssues(source, node, PUBLIC_NETWORK_CHECKS).map(({ node: target }) => target);
    const isSpread = node.arguments.some(({ type }) => type === AST_NODE_TYPES.SpreadElement);
    let instanceNode: TSESTree.Node | undefined;
    if (name === COMPUTE_INSTANCE) instanceNode = findPublicInterface(source, options);
    else if (name === RDS_INSTANCE) instanceNode = findPublicDatabase(source, options);
    return instanceNode === undefined || isSpread ? issues : [...issues, instanceNode];
}

export const awsPublicInstances = createRule<[], 'publicNetwork'>({
    name: 'aws-public-instances',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds EC2 instances, RDS database instances, and DMS replication instances that a public subnet or a public IP address makes reachable from the internet.',
            why: 'A public network address exposes the instance to attacks from the whole internet.',
            fix: 'Place the instance in a private subnet, and set `publiclyAccessible` or `associatePublicIpAddress` to `false`.',
            example:
                'The construction `new ec2.Instance(this, "Host", { vpc, vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC } })` reports `publicNetwork`. Use `ec2.SubnetType.PRIVATE_WITH_EGRESS`.',
        },
        schema: [],
        messages: { publicNetwork: 'Make sure that allowing public network access is safe here.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            NewExpression(node) {
                const found = listPublicNodes(source, node);
                for (const target of found) context.report({ node: target, messageId: 'publicNetwork' });
            },
        };
    },
});
