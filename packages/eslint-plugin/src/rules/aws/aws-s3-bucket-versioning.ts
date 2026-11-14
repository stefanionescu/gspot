import { createRule } from '../../rule.ts';
import { S3_VERSIONING_CHECKS } from '../../config/aws.ts';
import { listCdkTableIssues } from '../../libraries/aws.ts';

export const awsS3BucketVersioning = createRule<[], 'omitted' | 'unversioned'>({
    name: 'aws-s3-bucket-versioning',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Finds `new s3.Bucket` constructions that leave out `versioned` or set it to `false`.',
            why: 'Without versioning, a deleted or overwritten object is lost for good, by mistake or by an attacker.',
            fix: 'Set `versioned: true`.',
            example:
                'The construction `new s3.Bucket(this, "Records")` reports `omitted`. Use `new s3.Bucket(this, "Records", { versioned: true })`.',
        },
        schema: [],
        messages: {
            omitted: 'Leaving out versioned turns off the versioning of this S3 bucket. Set versioned to true.',
            unversioned: 'This S3 bucket keeps no versions. Set versioned to true.',
        },
    },
    create(context) {
        return {
            NewExpression(node) {
                for (const issue of listCdkTableIssues(context.sourceCode, node, S3_VERSIONING_CHECKS))
                    context.report({
                        node: issue.node,
                        messageId: issue.kind === 'omitted' ? 'omitted' : 'unversioned',
                    });
            },
        };
    },
});
