import { createRule } from '../rule.ts';
import { S3_BUCKET } from '../config/plugin.ts';
import type { PublicGrant } from '../types/rules.ts';
import { getExpressionValue } from '../language/expressions.ts';
import { getCdkName, findBucketOption } from '../libraries/aws.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { S3_DEPLOYMENT, GRANT_PUBLIC_ACCESS, ACCESS_CONTROL_PREFIX, PUBLIC_ACCESS_CONTROLS } from '../config/aws.ts';

function getAccessLevel(source: Readonly<TSESLint.SourceCode>, option: TSESTree.Property | null): string | undefined {
    const value = option ? getExpressionValue(option.value, source) : undefined;
    const name = value?.type === AST_NODE_TYPES.MemberExpression ? getCdkName(source, value) : undefined;
    const level = name?.startsWith(ACCESS_CONTROL_PREFIX) === true ? name.slice(ACCESS_CONTROL_PREFIX.length) : '';
    return PUBLIC_ACCESS_CONTROLS.has(level) ? level : undefined;
}

function listAccessGrants(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.NewExpression,
    name: string | undefined,
): PublicGrant[] {
    const control =
        name === S3_BUCKET || name === S3_DEPLOYMENT ? findBucketOption(source, node, 'accessControl') : null;
    const level = getAccessLevel(source, control);
    return control && level !== undefined ? [{ node: control, messageId: 'accessLevel', data: { level } }] : [];
}

function listReadGrants(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.NewExpression,
    name: string | undefined,
): PublicGrant[] {
    const read = name === S3_BUCKET ? findBucketOption(source, node, 'publicReadAccess') : null;
    const value = read ? getExpressionValue(read.value, source) : undefined;
    return read && value?.type === AST_NODE_TYPES.Literal && value.value === true
        ? [{ node: read, messageId: 'unrestricted' }]
        : [];
}

export const awsPublicBucketGrants = createRule<[], 'accessLevel' | 'unrestricted'>({
    name: 'aws-public-bucket-grants',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds S3 buckets and bucket deployments with a public `accessControl` (`PUBLIC_READ`, `PUBLIC_READ_WRITE`, or `AUTHENTICATED_READ`), buckets with `publicReadAccess: true`, and `grantPublicAccess` calls on buckets.',
            why: 'Public access lets anyone on the internet, or any AWS user, read or change the objects of the bucket.',
            fix: 'Keep the default private access, and grant access to the roles that need it.',
            example:
                'The construction `new s3.Bucket(this, "Site", { publicReadAccess: true })` reports `unrestricted`. Serve the files through CloudFront with an origin access control instead.',
        },
        schema: [],
        messages: {
            accessLevel: 'Make sure that granting {{level}} access is safe here.',
            unrestricted: 'Make sure that allowing unrestricted access to the objects of this bucket is safe here.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            NewExpression(node) {
                const name = getCdkName(source, node);
                const findings = [...listAccessGrants(source, node, name), ...listReadGrants(source, node, name)];
                for (const finding of findings) context.report(finding);
            },
            [`CallExpression > MemberExpression.callee[computed=false][property.name="${GRANT_PUBLIC_ACCESS}"]`](
                node: TSESTree.MemberExpression,
            ) {
                const owner = getExpressionValue(node.object, source);
                const isBucket =
                    owner?.type === AST_NODE_TYPES.NewExpression && getCdkName(source, owner) === S3_BUCKET;
                if (isBucket) context.report({ node: node.property, messageId: 'unrestricted' });
            },
        };
    },
});
