import { createRule } from '../../rule.ts';
import { getCdkName, findBucketOption } from '../../libraries/aws.ts';
import { getExpressionValue, getOptionProperties } from '../../language/expressions.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { S3_BUCKET, BLOCK_ACLS_ONLY, BLOCK_PUBLIC_ACCESS, BLOCK_PUBLIC_ACCESS_KEYS } from '../../config/aws.ts';

function listUnblockedSettings(
    source: Readonly<TSESLint.SourceCode>,
    value: TSESTree.Node | undefined,
): TSESTree.Property[] {
    const isBlockConstruction =
        value?.type === AST_NODE_TYPES.NewExpression &&
        value.callee.type === AST_NODE_TYPES.MemberExpression &&
        getCdkName(source, value.callee) === BLOCK_PUBLIC_ACCESS;
    const settings = getOptionProperties(isBlockConstruction ? value.arguments[0] : undefined, source);
    return [...settings].flatMap(([key, property]) => {
        const setting = getExpressionValue(property.value, source);
        const isOff = BLOCK_PUBLIC_ACCESS_KEYS.has(key) && setting?.type === AST_NODE_TYPES.Literal;
        return isOff && setting.value === false ? [property] : [];
    });
}

function listBucketIssues(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.NewExpression,
): Array<TSESLint.ReportDescriptor<'aclsOnly' | 'public'>> {
    const option = getCdkName(source, node) === S3_BUCKET ? findBucketOption(source, node, 'blockPublicAccess') : null;
    const value = option ? getExpressionValue(option.value, source) : undefined;
    const isAclsOnly = value?.type === AST_NODE_TYPES.MemberExpression && getCdkName(source, value) === BLOCK_ACLS_ONLY;
    const unblocked = listUnblockedSettings(source, value).map((setting) => ({
        node: setting,
        messageId: 'public' as const,
    }));
    return option && isAclsOnly ? [{ node: option, messageId: 'aclsOnly' }, ...unblocked] : unblocked;
}

export const awsUnblockedPublicBuckets = createRule<[], 'aclsOnly' | 'public'>({
    name: 'aws-unblocked-public-buckets',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds `new s3.Bucket` constructions whose `blockPublicAccess` is `BlockPublicAccess.BLOCK_ACLS_ONLY` or a `new BlockPublicAccess` with `blockPublicAcls`, `blockPublicPolicy`, `ignorePublicAcls`, or `restrictPublicBuckets` set to `false`.',
            why: 'Without these blocks, an access list or a bucket policy can make the objects of the bucket public.',
            fix: 'Use `blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL`, or leave the option at its default.',
            example:
                'The construction `new s3.Bucket(this, "Data", { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY })` reports `aclsOnly`. Use `s3.BlockPublicAccess.BLOCK_ALL`.',
        },
        schema: [],
        messages: {
            aclsOnly: 'BLOCK_ACLS_ONLY still lets a bucket policy make this S3 bucket public. Use BLOCK_ALL.',
            public: 'Turning off this public access block lets an access list or a policy make this S3 bucket public.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            NewExpression: (node) => {
                for (const issue of listBucketIssues(source, node)) context.report(issue);
            },
        };
    },
});
